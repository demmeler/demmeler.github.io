// ###############################################################################################################
// Main

var rkicsv = "https://opendata.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0.csv";
var kreisecsv = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/de/kreise.csv";
var germanymapurl = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/de/topology.json";
var incidencedataurl = "https://raw.githubusercontent.com/demmeler/demmeler.github.io/master/server/incidenceData.json"

var incidenceDataGlob

function scrollToTop() {
   document.body.scrollTop = 0; // For Safari
   document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
 }

function covplot() {
   $.getJSON(incidencedataurl, incidenceDataOutput => {
      incidenceDataGlob = incidenceDataOutput;
      incidencePlot(incidenceDataOutput);
   });
}

var tableGlob
var worldmapGlob

// ###############################################################################################################
// Plot

// output: {traces, mapdata, mapcolors}
function getPlotData(incidenceData) {
   var traces = [];
   var mapcolors = {};
   var mapdata = {};

   Object.keys(incidenceData).forEach(region => {
      var dataRow = incidenceData[region];

      if (!dataRow.incidence_available) {
         return;
      }

      var days = dataRow.trace.times;
      var incidence = dataRow.trace.incidence;
      var max = Math.max(...incidence);

      if (max > 0) {
         traces.push({
            name: dataRow.Name,
            region: region2str(region),
            x: days,
            y: incidence,
            mode: 'lines',
            line: {
               width: 1
            },
            active: false
         });

         trace = traces[traces.length - 1];
         var end = trace.y.length - 1;

         var colors = [];
         trace.y.forEach(val => {
            colors.push(valToColor(val));
         });

         mapdata[region2str(region)] = {
            color: valToColor(trace.y[end]),
            colors: colors,
            last_incidence: trace.y[end].toFixed(0),
            trace: trace
         };
         mapcolors[region2str(region)] = mapdata[region2str(region)].color;

         trace.heatmap = [{
            type: 'heatmap',
            x: days,
            y: [],
            z: [],
            zmin: 0.0,
            zmax: 2000.0,
            colorscale: [
               [0.0/2000.0,    valToColor(0.0)],
               [50.0/2000.0,   valToColor(50.0)],
               [100.0/2000.0,  valToColor(100.0)],
               [300.0/2000.0,  valToColor(300.0)],
               [2000.0/2000.0, valToColor(2000.0)],
            ]
         }];

         incidence_by_age = dataRow.trace.incidence_by_age

         Object.keys(incidence_by_age).forEach(agegroup => {
            trace.heatmap[0].y.push(agegroup)
            trace.heatmap[0].z.push(incidence_by_age[agegroup])
         });
      }
   });

   return { traces, mapdata, mapcolors };
}

// input: incidenceDataOutput = {tnow, incidenceData}
function incidencePlot(incidenceDataOutput) {
   var tnow = moment(incidenceDataOutput.tnow);
   var plotdata = getPlotData(incidenceDataOutput.incidenceData);
   var traces = plotdata.traces;

   var titleprefix = "Covid-19 Incidences - ";

   document.getElementById("title").textContent = titleprefix + tnow.format('DD.MM.YYYY');
   plotDiv = document.getElementById("plotdiv");
   heatmapDiv = document.getElementById("heatmapdiv")

   var layout = {
      title: 'Incidences',
      margin: {
         t: 50,
         pad: 4
      },
      xaxis: {
         title: 'Days (0 = ' + tnow.format('DD.MM.YYYY') + ')',
         showgrid: false,
         zeroline: false,
         fixedrange: true
      },
      yaxis: {
         title: 'Weekly new cases per 100k',
         showline: false,
         fixedrange: true,
         type: "log"
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

   var layoutheatmap = {
      title: 'Incidences by age group',
      xaxis: {
         title: 'Days (0 = ' + tnow.format('DD.MM.YYYY') + ')'
      }
   };

   var activeheatmap = [{
      z: [],
      type: 'heatmap'
   }];

   var activetraces = [];
   var globalgd;

   Plotly.newPlot(plotDiv, activetraces, layout, { staticPlot: true }).then(gd => { globalgd = gd; });
   Plotly.newPlot(heatmapDiv, activeheatmap, layoutheatmap)

   // ########################################################################

   var worldmapClick

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
            .scale(3800 * (element.offsetHeight / 600))
            .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
         var path = d3.geo.path().projection(projection);

         return { path: path, projection: projection };
      },
      geographyConfig: {
         borderWidth: 0.5,
         dataUrl: germanymapurl,
         highlightOnHover: true,
         highlightBorderColor: 'rgba(0, 0, 0, 1)',
         highlightBorderWidth: 0.5,
         popupOnHover: true,
         popupTemplate: function (geo, data) {
            if (true == worldmap.options.data.hasOwnProperty(geo.id)) {
               plothover(globalgd, geo.id, worldmap, activetraces);
            }

            return ['<div class="hoverinfo"><strong>', geo.properties.name, '</strong><br>',
               worldmap.options.data[geo.id].last_incidence, ' pro 100k</div>'].join('');
         }
      },
      data: plotdata.mapdata,

      // ########################################################################
      done: function (datamap) {
         // #####################################################################
         worldmapClick = function (geo) {
            if (false == worldmap.options.data.hasOwnProperty(geo.id)) {
               return;
            }

            var data = worldmap.options.data[geo.id];
            data.trace.active = !data.trace.active;

            activetraces = [];
            traces.forEach(trace => {
               if (trace.active) {
                  activetraces.push(trace);
               }
            });

            Plotly.newPlot(plotDiv, activetraces, layout, { staticPlot: true }).then(
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

            if (data.trace.active){
               activeheatmap = data.trace.heatmap
               layoutheatmap.title = 'Incidences by age group (' + data.trace.name + ')'
               Plotly.newPlot(heatmapDiv, activeheatmap, layoutheatmap)
            }
         }

         datamap.svg.selectAll('.datamaps-subunit').on('click', worldmapClick);

         // #####################################################################
         document.getElementById("resetbutton").onclick = function (evt) {
            Object.keys(worldmap.options.data).forEach(key => {
               worldmap.options.data[key].trace.active = false;
            });

            activetraces = [];

            Plotly.newPlot(plotDiv, activetraces, layout, { staticPlot: true }).then(
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
         slider = document.getElementById("timeslider");
         slider.addEventListener("input", function () {
            Object.keys(worldmap.options.data).forEach(key => {
               data = worldmap.options.data[key];
               data.color = data.colors[this.value];
               data.last_incidence = data.trace.y[this.value].toFixed(0);
            });

            tselected = moment(tnow).add(traces[0].x[this.value] + 1, "days");
            document.getElementById("title").textContent = titleprefix + tselected.format('DD.MM.YYYY');

            plothover(globalgd, null, worldmap, activetraces);
         });
         slider.min = 0;
         slider.max = traces[0].y.length - 1;
         slider.value = slider.max;

         // #####################################################################
         worldmap.updateChoropleth(plotdata.mapcolors);
      }
   });

   worldmapGlob = worldmap;

   function addTable(incidenceDataOutput) {
      var myTableDiv = document.getElementById("incidencetable");

      var table = document.createElement('TABLE');
      table.border = '1';

      var tableBody = document.createElement('TBODY');
      table.appendChild(tableBody);

      // Heading
      {
         var tr = document.createElement('TR');
         tableBody.appendChild(tr);

         {
            var td = document.createElement('TD');
            td.appendChild(document.createTextNode("Region"));
            tr.appendChild(td);
         }
         {
            var td = document.createElement('TD');
            td.appendChild(document.createTextNode("Incidence"));
            td.float = 'right';
            tr.appendChild(td);
         }
      }

      // Entries
      var incidenceData = incidenceDataOutput.incidenceData;
      var incidenceList = [];

      Object.keys(incidenceData).forEach(key => {
         var ele = incidenceData[key];
         var trace = ele.trace.incidence;
         ele.last_incidence = trace[trace.length - 1];
         incidenceList.push(incidenceData[key]);
      });

      incidenceList.sort((a, b) => {
         return b.last_incidence - a.last_incidence;
      });

      incidenceList.forEach(element => {
         var tr = document.createElement('TR');
         tableBody.appendChild(tr);

         {
            var td = document.createElement('TD');
            td.appendChild(document.createTextNode(element.Name));
            tr.appendChild(td);
         }
         {
            var td = document.createElement('TD');
            var vals = element.trace.incidence;
            td.appendChild(document.createTextNode(vals[vals.length - 1].toFixed(0)));
            td.align = 'right';
            tr.appendChild(td);
         }

         tr.onclick = () => {
            scrollToTop();
            worldmapClick({id: region2str(element.IdLandkreis)});
         };
      });

      tableGlob = table;
      table.style.borderCollapse='collapse';

      myTableDiv.appendChild(table);
   }

   addTable(incidenceDataOutput);
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
      if (treg == region) {
         geoupdate[region] = highlightColor(original, 'blue', 100);
         flashing = true;
      }
      else {
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
      'line.width': gd.data.map((_, i) => (gd.data[i].region == region) ? 1.6 : 1),
      'opacity': gd.data.map((_, i) => (gd.data[i].region == region) ? 1 : minop)
   };
   Plotly.restyle(gd, update);
}

// ###############################################################################################################
// Utility

function region2str(region) {
   return "r_" + String(region).padStart(5, "0");
}

function valToColor(val) {
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

   if (val < 50) {
      return paletteScale1(val);
   }
   else if (val < 100) {
      return paletteScale2(val);
   }
   else if (val < 300) {
      return paletteScale3(val);
   }
   else {
      return paletteScale4(val);
   }
}

function highlightColor(color, color2, percent) {
   var paletteScale = d3.scale.linear()
      .domain([0, 100])
      .range([color, color2]);

   return paletteScale(percent);
}
