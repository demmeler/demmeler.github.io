const csv = require('csv-parser');
const fs = require('fs');
const child_process = require('child_process');
const _ = require('lodash');
const moment = require('moment');

downloadRKI();

function blockBegin(name)
{
   console.log('');
   console.log('#######################################################################');
   console.log(name);
   console.log('#######################################################################');
   console.log('');
}

function downloadRKI()
{
   blockBegin('Load RKI_COVID19.csv ...');

   child_process.exec('wget -O RKI_COVID19.csv https://opendata.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0.csv')
   .on('close', (code) => {
      console.log('Done.');
      parseRKI();
   });
}

var data = [];

function parseRKI()
{
   blockBegin('Parse RKI_COVID19.csv');

   fs.createReadStream('RKI_COVID19.csv')
      .pipe(csv())
      .on('data', (row) => {
         data.push(row);
      })
      .on('end', () => {
         console.log(data[0]);
         parseKreise();
      });
}

var kreise = [];

function parseKreise()
{
   blockBegin('Parse kreise.csv');

   fs.createReadStream('../de/kreise.csv')
      .pipe(csv())
      .on('data', (row) => {
         row.Insgesamt = row.Insgesamt.replace(/\s/g, '');
         kreise.push(row);
      })
      .on('end', () => {
         console.log(kreise[0]);
         processData()
      });
}

function processData()
{
   blockBegin('Calculate incidence data');

   var populationData = getPopulationData(kreise);
   var incidenceDataOutput = getIncidenceDataRKI(data, populationData);

   console.log('Incidence data parsed.');
   console.log(incidenceDataOutput.incidenceData['01001']);

   blockBegin('Store data...');
   storeData(incidenceDataOutput, 'incidenceData.json');
   console.log('Done.');
}

// ###############################################################################################################
// Incidence data generation

// input:   data = [{Datenstand, Meldedatum, IdLandkreis, Landkreis, AnzahlFall, ...}, ...]
//          population[IdLandkreis] = {name, num}
// output:  out = {incidenceData, tnow}, incidenceData -> see code
function getIncidenceDataRKI(data, population) {
   var tnow = moment(data[0].Datenstand, "DD.MM.YYYY, hh:mm Uhr");
   var tmin = 0;
   var tmax = -1000;

   console.log('Calc time boundaries...')

   data.forEach(function (row) {
      var tdata = moment(row.Meldedatum, "YYYY/MM/DD hh:mm");
      var t = parseInt(tdata.diff(tnow, 'days'));
      row['t'] = t;
      tmin = (t < tmin) ? t : tmin;
      tmax = (t > tmax) ? t : tmax;
   });

   console.log('Data from day ' + tmin + ' to day ' + tmax + '.');

   console.log('Group case list...');
   var grouped = _.groupBy(data, 'IdLandkreis');

   console.log('Calc incidence graphs...');

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
      var c = 0;     // cases accumulated
      var c_lw = 0;  // cases 7 days before

      for (var time = tmin; time <= tmax; ++time) {
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

function storeData(data, path) {
   try {
      fs.writeFileSync(path, JSON.stringify(data))
   } catch (err) {
      console.error(err)
   }
}
