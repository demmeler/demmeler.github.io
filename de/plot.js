// #######################################################################################
// Main

var rkicsv = "https://opendata.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0.csv";
var countriescsv = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv";
var kreisecsv = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/de/landkreise.csv";
///var germanymapurl = "https://raw.githubusercontent.com/AliceWi/TopoJSON-Germany/master/germany.json";
var germanymapurl = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/de/topology.json";

function covplot() {
   Plotly.d3.csv(rkicsv, function (data) {
      Plotly.d3.csv(kreisecsv, function (kreise) {
         var populationData = getPopulationData(kreise);
         var incidenceData = getIncidenceData(data, populationData);
         incidencePlot(incidenceData, true);
      })
   });
}


function incidencePlot(incidenceData, prognose) {
   var globalmax = 0;
   var globalendmax = 0;

   Object.keys(incidenceData).forEach(region => {
      var dataRow = incidenceData[region];

      var incidences = dataRow.trace.incidence;

      var max = Math.max(...incidences);
      if (max > globalmax) {
         globalmax = max;
      }

      var endval = incidences[incidences.length - 1];
      if (endval > globalendmax) {
         globalendmax = endval
      }
   });

   var traces = [];
   var mapcolors = {};
   var mapdata = {};

   var paletteScale = d3.scale.linear()
      .domain([0, 100])
      .range(['green', 'red']);

   Object.keys(incidenceData).forEach(region => {
      var dataRow = incidenceData[region];

      if (!dataRow.incidence_available) {
         return;
      }

      var days = dataRow.trace.times;
      var newcases = dataRow.trace.incidence;
      var end = newcases.length - 1;
      var max = Math.max(...newcases);

      if (max > 0) {
         traces.push({
            name: dataRow.Name,
            region: region2str(region),
            x: days,
            y: newcases,
            mode: 'lines',
            line: {
               width: 1
            },
            active: false
         });

         trace1 = traces.length - 1;

         mapdata[region2str(region)] = {
            color: paletteScale(newcases[end]),
            cases: newcases[end],
            traces: [{ trace1: trace1 }]
         };
         mapcolors[region2str(region)] = mapdata[region2str(region)].color;
      }
   });

   plotDiv = document.getElementById("plotdiv");

   var layout = {
      title: 'Covid-19 incidence dashboard',
      xaxis: {
         title: 'Days',
         showgrid: false,
         zeroline: false
      },
      yaxis: {
         title: 'Weekly new cases per 100k',
         showline: false
      },
      hovermode: 'closest',
      shapes: [{
         type: 'line',
         x0: 0,
         y0: 0,
         x1: 0,
         yref: 'paper',
         y1: 1,
         line: {
            color: 'grey',
            width: 1.5,
            dash: 'dot'
         }
      }],
      showlegend: true
   };

   var activetraces = [];
   var globalgd;

   Plotly.newPlot(plotDiv, activetraces, layout);

   var worldmap = new Datamap({
      element: document.getElementById('map'),
      scope: 'counties',
      fills: {
         defaultFill: '#ABDDA4' //the keys in this object map to the "fillKey" of [data] or [bubbles]
      },
      projection: '',
      setProjection: function (element) {
         var projection = d3.geo.equirectangular()
            .center([15, 48])
            //.rotate([4, 0])
            .scale(2000)
         //.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
         var path = d3.geo.path().projection(projection);

         return { path: path, projection: projection };
      },
      data: mapdata,
      done: function (datamap) {
         datamap.svg.selectAll('.datamaps-subunit').on('click', function (geo) {
            if (false == worldmap.options.data.hasOwnProperty(geo.id)) {
               return;
            }

            var data = worldmap.options.data[geo.id];
            data.traces.forEach(t => {
               var active = traces[t.trace1].active;
               traces[t.trace1].active = active ? false : true;
            });

            activetraces = [];
            traces.forEach(trace => {
               if (trace.active) {
                  activetraces.push(trace);
               }
            });

            Plotly.newPlot(plotDiv, activetraces, layout).then(
               gd => {
                  globalgd = gd;
                  gd.on('plotly_hover', function (data) {
                     var k = data.points[0].curveNumber;
                     var region = gd.data[k].region;
                     plothover(gd, region, worldmap, activetraces);
                  })
                  plothover(gd, geo.id, worldmap, activetraces);
               }
            )
         });
         worldmap.updateChoropleth(mapcolors);
      },
      geographyConfig: {
         dataUrl: germanymapurl,
         highlightOnHover: false,
         popupOnHover: true,
         popupTemplate: function (geo, data) {
            if (true == worldmap.options.data.hasOwnProperty(geo.id)) {
               plothover(globalgd, geo.id, worldmap, activetraces);
            }
            return ['<div class="hoverinfo"><strong>',
               geo.properties.name,
               '</strong></div>'].join('');
         }
      }
   });
};

function plothover(gd, region, worldmap, activetraces) {
   // Flash country on map
   var geoupdate = {};

   for (var key in worldmap.options.data) {
      if (worldmap.options.data.hasOwnProperty(key)) {
         geoupdate[key] = worldmap.options.data[key].color;
      }
   }

   activetraces.forEach(function (trace) {
      geoupdate[trace.region] = 'blue';
   });

   var flashing = false;
   if (geoupdate[region] == 'blue') {
      geoupdate[region] = 'yellow';
      flashing = true;
   }

   worldmap.updateChoropleth(geoupdate);

   // Highlight trace
   var minop = 0.8;
   if (flashing) {
      minop = 0.2;
   }
   var update = {
      'line.width': gd.data.map((_, i) => (gd.data[i].region == region) ? 1.5 : 1),
      'opacity': gd.data.map((_, i) => (gd.data[i].region == region) ? 1 : minop)
   };
   Plotly.restyle(gd, update);
}

function getIncidenceData(data, population) {
   var tnow = moment(data[0].Datenstand, "DD.MM.YYYY, hh:mm Uhr");
   var tmin = 0;
   var tmax = -1000;

   for (var i = 0; i < data.length; ++i) {
      var tdata = moment(data[i].Refdatum, "YYYY/MM/DD hh:mm");
      var t = parseInt(tdata.diff(tnow, 'days'));
      data[i]['t'] = t;
      tmin = (t < tmin) ? t : tmin;
      tmax = (t > tmax) ? t : tmax;
   }

   var grouped = _.mapValues(_.groupBy(data, 'IdLandkreis'),
      clist => clist.map(d => _.omit(d, 'IdLandkreis')));

   var incidenceData = {};

   Object.keys(grouped).forEach(function (key) {
      incidenceData[key] = {
         IdLandkreis: key,
         Name: grouped[key][0].Landkreis,
         group: grouped[key],
         newcases: {},
         sum: 0,
         trace: {
            times: [],
            newcases: [],
            newcases_weekly: [],
            cases: [],
            incidence: [],
         },
         incidence_available: false,
         population: undefined
      };

      incidenceData[key].group.forEach(row => {
         incidenceData[key].newcases[row.t] = { num: 0, rows: [] };
      });

      incidenceData[key].group.forEach(row => {
         var num = parseInt(row.AnzahlFall);
         incidenceData[key].newcases[row.t].num += num;
         incidenceData[key].newcases[row.t].rows.push(row);
         incidenceData[key].sum += num;
      });

      var pop = population[key];
      if (typeof (pop) != "undefined") {
         incidenceData[key].incidence_available = true;
         incidenceData[key].population = pop.num;
      }

      var c = 0;
      var c_lw = 0;
      for (var time = tmin; time < tmax; ++time) {
         var entry = incidenceData[key].newcases[time];
         var nc = typeof (entry) == "undefined" ? 0 : entry.num;
         c += nc;

         var nc_lw = 0;
         if (time - 7 >= tmin) {
            var entry_lw = incidenceData[key].newcases[time - 7];
            nc_lw = typeof (entry_lw) == "undefined" ? 0 : entry_lw.num;
            c_lw += nc_lw;
         }

         incidenceData[key].trace.times.push(time);
         incidenceData[key].trace.newcases.push(nc);
         incidenceData[key].trace.cases.push(c);
         incidenceData[key].trace.newcases_weekly.push(c - c_lw);
         if (incidenceData[key].incidence_available) {
            incidenceData[key].trace.incidence.push((c - c_lw) * 100000.0 / pop.num);
         }
      }
   });

   return incidenceData;
}

function getPopulationData(kreise) {
   var grouped = _.mapValues(_.groupBy(kreise, 'Nummer'),
      clist => clist.map(d => _.omit(d, 'Nummer')));

   var population = {};

   Object.keys(grouped).forEach(key => {
      var popentry = {
         name: undefined,
         num: 0
      };

      grouped[key].forEach(entry => {
         popentry.num += parseInt(entry.Insgesamt);
      });

      if (!isNaN(popentry.num) && popentry.num > 0) {
         population[key] = popentry;
      }
   });

   return population;
}

// #######################################################################################
// Utility

function region2str(region) {
   return "r_" + region;
}

function str2region(str) {
   return str.substring(2);
}
