import os
import pandas as pd
import json
from tqdm import tqdm

def readRKI():
   print('Load RKI_COVID19.csv ...')

   rki_csv = pd.read_csv('RKI_COVID19.csv', dtype = {
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
      'Insgesamt' : int,
   }, thousands=' ')

   return kreise_csv

def calcIncidenceData(rki_csv : pd.DataFrame, kreise_csv : pd.DataFrame):

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
         },
         "incidence_available": False,
         "population": None
      }

      # population
      if lk_id in kreise_csv.index:
         population_number = kreise_csv.loc[lk_id].Insgesamt

         incidenceData[lk_id]['population'] = {
            'incidence_available' : True,
            'population' : int(population_number)
         }

         # newcases
         newcases = [0] * num_days
         for time, nc in lk_csv.groupby('t').AnzahlFall.sum().items():
            newcases[time - dmin] = nc

         # trace
         c = 0     # cases accumulated
         c_lw = 0  # cases 7 days before

         incidences = [0.] * num_days

         for time in range(dmin, dmax + 1):
            timeindex = time - dmin
            # current week
            c += newcases[timeindex]

            # last week
            if timeindex >= 7:
               c_lw += newcases[timeindex - 7]

            # trajectories
            incidences[timeindex] = (c - c_lw) * 100000.0 / population_number

         incidenceData[lk_id]['trace']['incidence'] = incidences

   return { "incidenceData": incidenceData, "tnow": today.strftime('%Y-%m-%dT%H:%M:%S.000Z') }

def downlaodRKI():
   if os.path.exists('RKI_COVID19.csv'):
      print('RKI_COVID19.csv already exists.')
   else:
      print('Download RKI_COVID19.csv ...')
      os.system('wget -O RKI_COVID19.csv https://opendata.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0.csv')

def saveIncidenceData(incidenceData : dict):
   print('Save incidence data to incidenceData.json')
   with open('incidenceData.json', 'w') as f:
      json.dump(incidenceData, f)


def main():
   downlaodRKI()
   rki_csv = readRKI()
   kreise_csv = readKreise()
   incidenceData = calcIncidenceData(rki_csv, kreise_csv)
   saveIncidenceData(incidenceData)

if __name__ == "__main__":
   main()