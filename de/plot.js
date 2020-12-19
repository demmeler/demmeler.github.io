// ###############################################################################################################
// Main

var rkicsv = "https://opendata.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0.csv";
var kreisecsv = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/de/kreise.csv";
var germanymapurl = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/de/topology.json";
var incidencedataurl = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/server/incidenceData.json"

function covplot() {
   $.getJSON(incidencedataurl, incidenceDataOutput => {
      console.log(incidenceDataOutput);
      incidencePlot(incidenceDataOutput);
   });
}

// ###############################################################################################################
// Plot

// output: {traces, mapdata, mapcolors}
function getPlotData(incidenceData)
{
   var traces = [];
   var mapcolors = {};
   var mapdata = {};

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
            color: valToColor(newcases[end]),
            cases: newcases[end],
            traces: [{ trace1: trace1 }]
         };
         mapcolors[region2str(region)] = mapdata[region2str(region)].color;
      }
   });

   return {traces, mapdata, mapcolors};
}

// input: incidenceDataOutput = {tnow, incidenceData}
function incidencePlot(incidenceDataOutput) {
   var tnow = moment(incidenceDataOutput.tnow);
   var plotdata = getPlotData(incidenceDataOutput.incidenceData);
   var traces = plotdata.traces;

   document.getElementById("title").textContent = "Stand: " + tnow.format('DD.MM.YYYY');
   plotDiv = document.getElementById("plotdiv");

   var layout = {
      title: 'Covid-19 incidence',
      xaxis: {
         title: 'Days (0 = ' + tnow.format('DD.MM.YYYY') + ')',
         showgrid: false,
         zeroline: false,
         fixedrange: true
      },
      yaxis: {
         title: 'Weekly new cases per 100k',
         showline: false,
         fixedrange: true
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

   Plotly.newPlot(plotDiv, activetraces, layout, {staticPlot: true});

   // ########################################################################

   var worldmap = new Datamap({
      element: document.getElementById('map'),
      scope: 'counties',
      fills: {
         defaultFill: '#ABDDA4' //the keys in this object map to the "fillKey" of [data] or [bubbles]
      },
      projection: '',
      setProjection: function (element) {
         var projection = d3.geo.equirectangular()
            .center([10.5, 51.0])
            //.rotate([4, 0])
            .scale(3800*(element.offsetHeight/600))
            .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
         var path = d3.geo.path().projection(projection);

         return { path: path, projection: projection };
      },
      geographyConfig: {
         borderWidth: 0.5,
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
      },
      data: plotdata.mapdata,

      // ########################################################################
      done: function (datamap) {
         // #####################################################################
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

            Plotly.newPlot(plotDiv, activetraces, layout, {staticPlot: true}).then(
               gd => {
                  globalgd = gd;
                  gd.on('plotly_hover', function (data) {
                     var k = data.points[0].curveNumber;
                     var region = gd.data[k].region;
                     plothover(gd, region, worldmap, activetraces);
                  });
                  plothover(gd, geo.id, worldmap, activetraces);
               }
            )
         });

         // #####################################################################
         document.getElementById("resetbutton").onclick = function (evt) {
            Object.keys(worldmap.options.data).forEach(key => {
               worldmap.options.data[key].traces.forEach(t => {
                  traces[t.trace1].active = false;
               });
            });

            activetraces = [];
            traces.forEach(trace => {
               if (trace.active) {
                  activetraces.push(trace);
               }
            });

            Plotly.newPlot(plotDiv, activetraces, layout, {staticPlot: true}).then(
               gd => {
                  globalgd = gd;
                  gd.on('plotly_hover', function (data) {
                     var k = data.points[0].curveNumber;
                     var region = gd.data[k].region;
                     plothover(gd, region, worldmap, activetraces);
                  });
                  plothover(gd, null, worldmap, activetraces);
               }
            )
         };

         // #####################################################################
         worldmap.updateChoropleth(plotdata.mapcolors);
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

   var flashing = false;

   activetraces.forEach(function (trace) {
      var treg = trace.region;
      var original = geoupdate[treg];
      if (treg == region)
      {
         geoupdate[region] = highlightColor(original, 'blue', 100);
         flashing = true;
      }
      else
      {
         geoupdate[treg] = highlightColor(original, 'blue', 75);
      }
   });

   worldmap.updateChoropleth(geoupdate);

   // Highlight trace
   var minop = 0.8;
   if (flashing) {
      minop = 0.5;
   }
   var update = {
      'line.width': gd.data.map((_, i) => (gd.data[i].region == region) ? 1.2 : 1),
      'opacity': gd.data.map((_, i) => (gd.data[i].region == region) ? 1 : minop)
   };
   Plotly.restyle(gd, update);
}

// ###############################################################################################################
// Incidence data generation

// input:   data = [{Datenstand, Refdatum, IdLandkreis, Landkreis, AnzahlFall, ...}, ...]
//          population[IdLandkreis] = {name, num}
// output:  out = {incidenceData, tnow}, incidenceData -> see code
function getIncidenceDataRKI(data, population) {
   var tnow = moment(data[0].Datenstand, "DD.MM.YYYY, hh:mm Uhr");
   var tmin = 0;
   var tmax = -1000;

   data.forEach(function(row) {
      var tdata = moment(row.Meldedatum, "YYYY/MM/DD hh:mm");
      var t = parseInt(tdata.diff(tnow, 'days'));
      row['t'] = t;
      tmin = (t < tmin) ? t : tmin;
      tmax = (t > tmax) ? t : tmax;
   });

   console.log(tmin);
   console.log(tmax);

   var grouped = _.mapValues(_.groupBy(data, 'IdLandkreis'),
      clist => clist.map(d => _.omit(d, 'IdLandkreis')));

   console.log('grouped');

   var incidenceData = {};

   Object.keys(grouped).forEach(function (key) {
      incidenceData[key] = {
         IdLandkreis: key,
         Name: grouped[key][0].Landkreis,
         trace: {
            times: [],
            // debug newcases: [],
            // debug newcases_weekly: [],
            // debug cases: [],
            incidence: [],
         },
         incidence_available: false,
         population: undefined
      };

      // newcases
      // sum
      var newcases = {};
      var sum = 0;

      grouped[key].forEach(row => {
         newcases[row.t] = { num: 0, rows: [] };
      });

      grouped[key].forEach(row => {
         var num = parseInt(row.AnzahlFall);
         newcases[row.t].num += num;
         sum += num;
      });

      // population
      // incidence_available
      var pop = population[key];
      if (typeof (pop) != "undefined") {
         incidenceData[key].incidence_available = true;
         incidenceData[key].population = pop.num;
      }

      // trace
      var c = 0;
      var c_lw = 0;

      for (var time = tmin; time < tmax; ++time) {
         // current week
         var entry = newcases[time];
         var nc = typeof (entry) == "undefined" ? 0 : entry.num;
         c += nc;

         // last week
         if (time - 7 >= tmin) {
            var entry_lw = newcases[time - 7];
            var nc_lw = typeof (entry_lw) == "undefined" ? 0 : entry_lw.num;
            c_lw += nc_lw;
         }

         // trajectories
         incidenceData[key].trace.times.push(time);
         // debug incidenceData[key].trace.newcases.push(nc);
         // debug incidenceData[key].trace.cases.push(c);
         // debug incidenceData[key].trace.newcases_weekly.push(c - c_lw);
         if (incidenceData[key].incidence_available) {
            incidenceData[key].trace.incidence.push((c - c_lw) * 100000.0 / pop.num);
         }
      }
   });

   return { incidenceData: incidenceData, tnow: tnow };
}

// input:   kreise = [{Nummer, Insgesamt}, ...]
// ouptut:  population[Nummer] = {name, num}
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

// return: {globalmax, globalendmax}
function getGlobalmax(incidenceData)
{
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

   return {globalmax, globalendmax};
}

// ###############################################################################################################
// Utility

function region2str(region) {
   return "r_" + region;
}

function valToColor(val)
{
   var paletteScale1 = d3.scale.linear()
      .domain([0, 50])
      .range(['green', 'yellow']);

   var paletteScale2 = d3.scale.linear()
      .domain([50, 100])
      .range(['yellow', 'red']);

   var paletteScale3 = d3.scale.linear()
      .domain([100, 300])
      .range(['red', '#ff00ff']);

   var paletteScale4 = d3.scale.linear()
      .domain([300, 2000])
      .range(['#ff00ff', 'black'])

   if (val < 50)
   {
      return paletteScale1(val);
   }
   else if (val < 100)
   {
      return paletteScale2(val);
   }
   else if (val < 300)
   {
      return paletteScale3(val);
   }
   else{
      return paletteScale4(val);
   }
}

function highlightColor(color, color2, percent)
{
   var paletteScale = d3.scale.linear()
      .domain([0, 100])
      .range([color, color2]);

   return paletteScale(percent);
}
