import redis, json, requests

languages = [["English (United States)",	"en_US"], ["Spanish (Mexico)",	"es_MX"], ["Portuguese",	"pt_BR"], ["German",	"de_DE"], ["English (Great Britain)",	"en_GB"], ["Spanish (Spain)",	"es_ES"], ["French",	"fr_FR"], ["Italian",	"it_IT"], ["Russian",	"ru_RU"], ["Korean",	"ko_KR"], ["Chinese (Traditional)",	"zh_TW"], ["Chinese (Simplified)",	"zh_CN"],]

rd = rd = redis.StrictRedis(password='')

keys = rd.keys('*')
jsons = [json.loads(rd.get(key)) for key in keys]
itemIds = [[x['guid'] for x in json] for json in jsons]
flatItemIds = [item for sublist in itemIds for item in sublist]
itemIds = set(flatItemIds)

# print(list(itemIds))
items = [
  {
    'guid': 17538,
    'itemId': 13452,
  },
  {
    'guid': 17539,
    'itemId': 13454,
  },
  {
    'guid': 17540,
    'itemId': 13455,
  },
  {
    'guid': 3593,
    'itemId': 3825,
  },
  {
    'guid': 16138,
    'itemId': 12404,
  },
  {
    'guid': 11405,
    'itemId': 9206,
  },
  {
    'guid': 17038,
    'itemId': 12820,
  },
  {
    'guid': 3223,
    'itemId': 3826,
  },
  {
    'guid': 23063,
    'itemId': 18641,
  },
  {
    'guid': 16666,
    'itemId': 12662,
  },
  {
    'guid': 26276,
    'itemId': 21546,
  },
  {
    'guid': 24361,
    'itemId': 20004,
  },
  {
    'guid': 13241,
    'itemId': 10646,
  },
  {
    'guid': 24382,
    'itemId': 20079,
  },
  {
    'guid': 24383,
    'itemId': 20081,
  },
  {
    'guid': 11334,
    'itemId': 9187,
  },
  {
    'guid': 22729,
    'itemId': 18253,
  },
  {
    'guid': 11474,
    'itemId': 9264,
  },
  {
    'guid': 11348,
    'itemId': 13445,
  },
  {
    'guid': 11349,
    'itemId': 8951,
  },
  {
    'guid': 6615,
    'itemId': 5634,
  },
  {
    'guid': 17626,
    'itemId': 13510,
  },
  {
    'guid': 17627,
    'itemId': 13511,
  },
  {
    'guid': 17628,
    'itemId': 13512,
  },
  {
    'guid': 27869,
    'itemId': 20520,
  },
  {
    'guid': 3169,
    'itemId': 3387,
  },
  {
    'guid': 11364,
    'itemId': 9036,
  },
  {
    'guid': 22756,
    'itemId': 18262,
  },
  {
    'guid': 17531,
    'itemId': 13444,
  },
  {
    'guid': 17534,
    'itemId': 13446,
  },
]
for language, lcode in languages:
  for item in items:
    url = f"https://us.api.blizzard.com/data/wow/item/{item['itemId']}?namespace=static-classic-us&locale={lcode}&access_token=USd4uAQY3GVpyam31Cbj9W3y5MZWma07Uf"
    r = requests.get(url)
    
    if r.status_code == 200:
      with open(f'data/{item["guid"]}_{lcode}.json', 'w') as fp:
        json.dump(r.json(), fp)