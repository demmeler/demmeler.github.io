// #######################################################################################
// Main

var casescsv = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv";
var deathscsv = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv";
var countriescsv = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv";

function covplot() {
   Plotly.d3.csv(casescsv, function (data) {
      Plotly.d3.csv(countriescsv, function (countrydata) {
         var countries = [
            {},
            /*{ c: "Germany", r: "" },
            { c: "Austria", r: "" },
            { c: "Italy", r: "" },
            { c: "Spain", r: "" },
            { c: "Sweden", r: "" },
            { c: "US", r: "" },
            { c: "Brazil", r: "" },
            { c: "India" },
            { c: "Switzerland", r: "" },
            //{ c: "China" },
            { c: "Netherlands", r: "" },
            { c: "France", r: "" },
            { c: "Quatar" },
            { c: "United Kingdom", r: "" }*/
         ];
         var filteredData = getCountryData(countries, data, countrydata);
         var incidenceData = getIncidenceData(filteredData);
         incidencePlot(incidenceData, true);

      })
   });
}

function getCountryData(countries, dataUnfiltered, countrydataUnfiltered) {
   var data = filterByCountry(dataUnfiltered, countries);
   writeCountryData(data, countrydataUnfiltered);

   return data;
}

function getIncidenceData(data) {
   var incidenceData = [];

   data.forEach(function (countryRow) {
      var incidenceEntry = {
         name: (countryRow['Country/Region'] + " " + countryRow['Province/State']),
         dates: [],
         newcases: [],
         country: countryRow.country
      };

      for (var i = -200; i <= 0; ++i) {
         var dateIndex = date(i - 1);
         var lastDateIndex = date(i - 8);

         if (typeof (countryRow[lastDateIndex]) != "undefined") {
            var cases = countryRow[dateIndex] - countryRow[lastDateIndex];
            var cases_per100k = cases * (100000.0 / countryRow.country['Population']);

            incidenceEntry.dates.push(i);
            incidenceEntry.newcases.push(cases_per100k);
         }
      }

      incidenceData.push(incidenceEntry);
   })

   return incidenceData;
}

function incidencePlot(incidenceData, prognose) {
   var globalmax = 0;
   var globalendmax = 0;

   incidenceData.forEach(function (dataRow) {
      var max = Math.max(...dataRow.newcases);
      if (max > globalmax) {
         globalmax = max;
      }

      var endval = dataRow.newcases[dataRow.newcases.length - 1];
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

   incidenceData.forEach(function (dataRow) {
      var days = dataRow.dates;
      var newcases = dataRow.newcases;

      var Dt_prog = 25;
      var begin = days.length - Dt_prog;
      var end = days.length - 1;
      var factor = (newcases[end] + 0.01) / (newcases[begin] + 0.01);
      var Dt = end - begin;
      var k = Math.log(factor) / Dt;

      var max = Math.max(...newcases);

      var days_prog = [];
      var newcases_prog = [];
      for (var di = -Dt_prog; di < 100; di += 1) {
         var prog = newcases[end] * Math.exp(k * di);
         if (prog < Math.max(150, 1.5 * max)) {
            days_prog.push(di);
            newcases_prog.push(prog);
         }
      }

      if (max > 0) {
         traces.push({
            name: dataRow.name,
            country: dataRow.country,
            x: days,
            y: newcases,
            mode: 'lines',
            line: {
               width: 1
            },
            active: false,
            //visible: 'legendonly'
         });

         trace1 = traces.length - 1;

         if (true == prognose) {
            traces.push({
               name: (dataRow.name),
               country: dataRow.country,
               x: days_prog,
               y: newcases_prog,
               mode: 'lines',
               line: {
                  dash: 'dot',
                  width: 1
               },
               active: false,
               //visible: 'legendonly'
            });

            trace2 = traces.length - 1;
         }

         if (typeof(mapdata[dataRow.country.iso3]) == "undefined"){
            mapdata[dataRow.country.iso3] = {cases: 0};
         }
         var entry = mapdata[dataRow.country.iso3];
         entry.color = paletteScale(Math.max(entry.cases, newcases[end]));
         entry.cases = newcases[end];
         var t = prognose ? {trace1: trace1, trace2: trace2} : {trace1: trace1};
         if (typeof(entry.traces) == "undefined") {
            entry.traces = [t];
         }
         else {
            entry.traces.push(t);
         }
         mapcolors[dataRow.country.iso3] = entry.color;
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
         //type: 'log',
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
      }]
   };

   var activetraces = [];
   var globalgd;

   Plotly.newPlot(plotDiv, activetraces, layout);

   var worldmap = new Datamap({
      element: document.getElementById('map'),
      data: mapdata,
      done: function (datamap) {
         datamap.svg.selectAll('.datamaps-subunit').on('click', function (geo) {
            if (false == worldmap.options.data.hasOwnProperty(geo.id)) {
               return;
            }

            var data = worldmap.options.data[geo.id];
            data.traces.forEach(function (t) {
               var active = traces[t.trace1].active;
               traces[t.trace1].active = active ? false : true;
               if (prognose) {
                  traces[t.trace2].active = traces[t.trace1].active;
               }
            });

            activetraces = [];
            traces.forEach(function (trace) {
               if (trace.active) {
                  activetraces.push(trace);
               }
            });

            Plotly.newPlot(plotDiv, activetraces, layout).then(
               gd => {
                  globalgd = gd;
                  gd.on('plotly_hover', function (data) {
                     var k = data.points[0].curveNumber;
                     var iso3 = gd.data[k].country.iso3;
                     plothover(gd, iso3, worldmap, activetraces);
                  })
                  plothover(gd, geo.id, worldmap, activetraces);
               }
            )
         });
      },
      geographyConfig: {
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

   worldmap.updateChoropleth(mapcolors);
};

function plothover(gd, iso3, worldmap, activetraces) {
   // Flash country on map
   var geoupdate = {};

   for (var key in worldmap.options.data) {
      if (worldmap.options.data.hasOwnProperty(key)) {
         geoupdate[key] = worldmap.options.data[key].color;
      }
   }

   activetraces.forEach(function (trace) {
      geoupdate[trace.country.iso3] = 'blue';
   });

   var flashing = false;
   if (geoupdate[iso3] == 'blue') {
      geoupdate[iso3] = 'yellow';
      flashing = true;
   }

   worldmap.updateChoropleth(geoupdate);

   // Highlight trace
   var minop = 0.8;
   if (flashing) {
      minop = 0.2;
   }
   var update = {
      'line.width': gd.data.map((_, i) => (gd.data[i].country.iso3 == iso3) ? 1.5 : 1),
      'opacity': gd.data.map((_, i) => (gd.data[i].country.iso3 == iso3) ? 1 : minop)
   };
   Plotly.restyle(gd, update);
}

// #######################################################################################
// Utility

function date(i) {
   var date = new Date(new Date().setDate(new Date().getDate() - 1 + i));
   var dateString = (date.getMonth() + 1) + "/" + date.getDate() + "/" + (date.getFullYear() - 2000);

   return dateString;
}

function round(x, n) {
   return Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
}

function filterByCountry(data, values) {
   return data.filter(
      function (data) {
         var ret = false;
         values.forEach(function (value) {
            if ((data['Country/Region'] == value.c) || (typeof (value.c) == "undefined")) {
               if ((data['Province/State'] == value.r) || (typeof (value.r) == "undefined")) {
                  ret = true;
               }
            }
         });
         return ret;
      }
   );
}

function writeCountryData(data, countryData) {
   data.forEach(
      function (row) {
         countryData.forEach(function (countryRow) {
            if ((row['Country/Region'] == countryRow['Country_Region']) &&
               (row['Province/State'] == countryRow['Province_State'])) {
               row.country = countryRow;
            }
         })
      }
   );
}
