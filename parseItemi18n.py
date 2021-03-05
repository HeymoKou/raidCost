from glob import glob
import json


jsons = glob('data/*.json')

itemDic = {}

for jsonpath in jsons:

  splt = jsonpath.split('/')[-1].split('.')[0].split('_')
  guid = int(splt[0])
  locale = '_'.join(splt[1:])

  with open(jsonpath, 'r') as fp:
    obj = json.load(fp)

  if guid not in itemDic:
    itemDic[guid] = {}

  itemDic[guid][locale] = obj['name']

header = ["en_US", "es_MX", "pt_BR", "de_DE", "en_GB", "es_ES", "fr_FR", "it_IT", "ru_RU", "ko_KR", "zh_TW", "zh_CN",]
with open('itemTable.tsv', 'w') as fp:
  fp.write('\t'.join(['guid'] + header) + '\n')
  for key, value in itemDic.items():
    fp.write('\t'.join([str(key)] + [value[locale] if value[locale] else 'N/A' for locale in header]) + '\n')


# print(itemDic)