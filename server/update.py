import os
import pandas as pd
import json
from tqdm import tqdm

def readRKI():
   print('Load RKI_COVID19.csv ...')

   rki_csv = pd.read_csv('RKI_COVID19.csv', dtype = {
      "IdLandkreis" : int,
      "Datenstand" : str,
      "Meldedatum" : str,
      "Refdatum" : str,
   })

   rki_csv.Datenstand = pd.to_datetime(rki_csv.Datenstand,  format='%d.%m.%Y, %H:%M Uhr').dt.tz_localize(None)
   rki_csv.Meldedatum = pd.to_datetime(rki_csv.Meldedatum,  format='%Y/%m/%d %H:%M:%S').dt.tz_localize(None)
   rki_csv.Refdatum =   pd.to_datetime(rki_csv.Refdatum,    format='%Y/%m/%d %H:%M:%S').dt.tz_localize(None)

   return rki_csv

def readKreise():
   print('Load kreise.csv ...')

   kreise_csv = pd.read_csv('../de/kreise.csv', index_col='Nummer', dtype={
      'Nummer' : int,
      'Insgesamt' : int,
   }, thousands=' ')

   return kreise_csv

def readDemography():
   print('Load demografie.csv ...')

   demography_csv = pd.read_csv('../de/demografie.csv', sep=';')\
      .set_index(['Variante', 'Simulationsjahr', 'mw']).loc[1, 2021].sum()

   agegroups = {
      'A00-A04': {'min':  0, 'max':  4, 'population_proportion': 0.0},
      'A05-A14': {'min':  5, 'max': 14, 'population_proportion': 0.0},
      'A15-A34': {'min': 15, 'max': 34, 'population_proportion': 0.0},
      'A35-A59': {'min': 35, 'max': 59, 'population_proportion': 0.0},
      'A60-A79': {'min': 60, 'max': 79, 'population_proportion': 0.0},
      'A80+':    {'min': 80, 'max': 99, 'population_proportion': 0.0},
   }

   # calculate proportions of age groups of whole population
   for agegroup in agegroups:
      entry = agegroups[agegroup]
      columns = ['Bev_' + str(x) + '_' + str(x+1) for x in range(entry['min'], entry['max']+1)]
      entry['population_proportion'] = demography_csv[columns].sum() / demography_csv['Bev']

   # consistency check (sum ~ 1.0)
   sum = 0.0
   for agegroup in agegroups:
      entry = agegroups[agegroup]
      sum += entry['population_proportion']

   assert(abs(sum-1.0)<0.001)

   return agegroups

def calcIncidences(newcases, population_number):
   num_days = len(newcases)
   c = 0     # cases accumulated
   c_lw = 0  # cases 7 days before

   incidences = [0.] * num_days

   for timeindex in range(num_days):
      # current week
      c += newcases[timeindex]

      # last week
      if timeindex >= 7:
         c_lw += newcases[timeindex - 7]

      # trajectories
      incidences[timeindex] = (c - c_lw) * 100000.0 / population_number

   return incidences

def calcIncidenceData(rki_csv : pd.DataFrame, kreise_csv : pd.DataFrame, agegroups : dict):

   # calc time axis in dates, 0 = today
   today = rki_csv.iloc[0].Datenstand
   rki_csv['t'] = (rki_csv.Meldedatum - today).dt.days
   dmin_glob = rki_csv['t'].min()
   dmax_glob = rki_csv['t'].max()

   print('today: ', today)
   print('Data from day', dmin_glob, 'to', dmax_glob)
   print('Process by IdLandkreis ...')

   incidenceData = {}

   for lk_id, lk_csv in tqdm(rki_csv.groupby('IdLandkreis')):
      dmin = lk_csv['t'].min()
      dmax = lk_csv['t'].max()
      num_days = dmax - dmin + 1

      incidenceData[lk_id] = {
         "IdLandkreis": lk_id,
         "Name": lk_csv.iloc[0].Landkreis,
         "trace": {
            "times": [time for time in range(dmin, dmax + 1)],
            "incidence": None,
            "incidence_by_age": {}
         },
         "incidence_available": False,
         "population": None
      }

      # population
      if lk_id in kreise_csv.index:
         population_number = kreise_csv.loc[lk_id].Insgesamt

         incidenceData[lk_id]['population'] = int(population_number)
         incidenceData[lk_id]['incidence_available'] = True

         # newcases
         newcases = [0] * num_days
         for time, nc in lk_csv.groupby('t').AnzahlFall.sum().items():
            newcases[time - dmin] = nc

         # newcases by age
         newcases_by_age = {}
         for age, lk_age_csv in lk_csv.groupby('Altersgruppe'):
            newcases_age = [0] * num_days
            for time, nc in lk_age_csv.groupby('t').AnzahlFall.sum().items():
               newcases_age[time - dmin] = nc
            newcases_by_age[age] = newcases_age

         # trace
         incidenceData[lk_id]['trace']['incidence'] = calcIncidences(newcases, population_number)

         for age, newcases_age in newcases_by_age.items():
            if age in agegroups:
               population_number_age = population_number * agegroups[age]['population_proportion']
               incidenceData[lk_id]['trace']['incidence_by_age'][age] = calcIncidences(newcases_age, population_number_age)

   return { "incidenceData": incidenceData, "tnow": today.strftime('%Y-%m-%dT%H:%M:%S.000Z') }

def downlaodRKI():
   if os.path.exists('RKI_COVID19.csv'):
      print('RKI_COVID19.csv already exists.')
   else:
      print('Download RKI_COVID19.csv ...')
      #os.system('wget -O RKI_COVID19.csv https://opendata.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0.csv')
      #os.system('wget -O RKI_COVID19.csv https://ago-item-storage.s3.us-east-1.amazonaws.com/f10774f1c63e40168479a1feb6c7ca74/RKI_COVID19.csv')
      os.system('wget -O RKI_COVID19.csv https://www.arcgis.com/sharing/rest/content/items/f10774f1c63e40168479a1feb6c7ca74/data')
def saveIncidenceData(incidenceData : dict):
   print('Save incidence data to incidenceData.json')
   with open('incidenceData.json', 'w') as f:
      json.dump(incidenceData, f)

def main():
   downlaodRKI()
   rki_csv = readRKI()
   kreise_csv = readKreise()
   agegroups = readDemography()
   incidenceData = calcIncidenceData(rki_csv, kreise_csv, agegroups)
   saveIncidenceData(incidenceData)

if __name__ == "__main__":
   main()