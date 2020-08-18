// #######################################################################################
// Main

var rkicsv = "https://opendata.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0.csv";
var countriescsv = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv";
var kreisecsv = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/de/landkreise.csv";

function covplot() {
   Plotly.d3.csv(rkicsv, function (data) {
      Plotly.d3.csv(kreisecsv, function (kreise) {
         console.log('Loaded');

         var populationData = getPopulationData(kreise);
         var incidenceData = getIncidenceData(data, populationData);
         incidencePlot(incidenceData, true);
      })
   });
}

function incidencePlot(incidenceData, prognose) {
   var regions = [
      '097'
   ];

   var traces = [];

   Object.keys(incidenceData).forEach(key => {
      var hit = false;
      regions.forEach(region => {
         if (key.indexOf(region) == 0) {
            hit = true;
         }
      });
      if (hit) {
         traces.push({
            name: incidenceData[key].Name,
            x: incidenceData[key].trace.times,
            y: incidenceData[key].trace.incidence,
            mode: 'lines',
            line: {
               width: 1
            }
         });
      }
   });

   plotDiv = document.getElementById("plotdiv");

   var layout = {
      title: 'Covid-19 dashboard',
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

   Plotly.newPlot(plotDiv, traces, layout).then(
      gd => {
         gd.on('plotly_hover', function (data) {
            var k = data.points[0].curveNumber;

            // Highlight trace
            var minop = 0.2;
            var update = {
               'line.width': gd.data.map((_, i) => (i == k) ? 1.5 : 1),
               'opacity': gd.data.map((_, i) => (i == k) ? 1 : minop)
            };
            Plotly.restyle(gd, update);

         });
      }
   );

   var map = new Datamap({
      scope: 'counties',
      element: document.getElementById('map'),
      projection: '',
      geographyConfig: {
         dataUrl: 'https://raw.githubusercontent.com/AliceWi/TopoJSON-Germany/master/germany.json'
      },
      fills: {
         defaultFill: '#ABDDA4' //the keys in this object map to the "fillKey" of [data] or [bubbles]
      },
      setProjection: function (element) {
         var projection = d3.geo.equirectangular()
            .center([15, 48])
            //.rotate([4, 0])
            .scale(2000)
            //.translate([element.offsetWidth / 2, element.offsetHeight / 2]);
         var path = d3.geo.path()
            .projection(projection);

         return { path: path, projection: projection };
      }
   });
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

function fiter() {

}
