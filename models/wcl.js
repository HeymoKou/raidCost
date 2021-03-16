const axios = require('axios')
const redis = require('redis')
const client = redis.createClient(require('../config/redisConfig'))
const authKey = { auth: require('../config/wclConfig') }
const url = 'https://classic.warcraftlogs.com/oauth/token'
const params = { grant_type: 'client_credentials' }
const { promisify } = require("util")
const existsAsync = promisify(client.exists).bind(client)
const getAsync = promisify(client.get).bind(client)
const mariadb = require('mariadb')
const itemLocaleDic = require('../itemLocale.json')

const pool = mariadb.createPool(Object.assign(
  require('../config/mariaDBConfig.json'), {
  user: 'rcAdmin',
  connectionLimit: 5
}))

let accessToken

const getConsumedBuffs = async (accessToken, raidLogId) => {
  var options = {
    method: 'POST',
    url: 'https://classic.warcraftlogs.com/api/v2/client',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    data: {
      query : 
       `{
          reportData {
            report(code: "${raidLogId}") {
              table(startTime: 0, endTime: 100000000, dataType: Buffs, hostilityType: Friendlies, translate: true) 
            }
          }
        }`
    }
  }

  const res = await axios.request(options)
  if ('errors' in res.data) {
    console.log("incorrect or private raid log")
    return
  }
  const result = res.data.data.reportData.report.table.data.auras
    .filter(aura => {
      return aura.abilityIcon.includes('potion')
    })
    .map(aura => {      
      return {
        guid: aura.guid,
        totalUses: aura.totalUses
      }
    })
  return result
}


const checkVisibility = async raidLogId => {
  var options = {
    method: 'POST',
    url: 'https://classic.warcraftlogs.com/api/v2/client',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    data: {
      query : 
       `{
        reportData {
          report(code: "${raidLogId}") {
            visibility
            zone {
              name
            }
          }
        }
      }`
    }
  }

  const res = await axios.request(options)
  if ('errors' in res.data) {
    return
  }

  if (res.data.data.reportData.report.visibility != 'public') 
    return false
  
  return {
    zone: res.data.data.reportData.report.zone.name,
    raidLogId: raidLogId
  }
}

const usRegion = ["Anathema", "Arcanite Reaper", "Arugal", "Ashkandi", "Atiesh", "Azuresong", "Benediction", "Bigglesworth", "Blaumeux", "Bloodsail Buccaneers", "Deviate Delight", "Earthfury", "Faerlina", "Fairbanks", "Felstriker", "Grobbulus", "Heartseeker", "Herod", "Incendius", "Kirtonos", "Kromcrush", "Kurinnaxx", "Loatheb", "Mankrik", "Myzrael", "Netherwind", "Old Blanchy", "Pagle", "Rattlegore", "Remulos", "Skeram", "Smolderweb", "Stalagg", "Sul'thraze", "Sulfuras", "Thalnos", "Thunderfury", "Westfall", "Whitemane", "Windseeker", "Yojamba"]
let regionDic = {}
const euRegion = [
  ...["Ashbringer", "Bloodfang", "Dragonfang", "Dreadmist", "Earthshaker", "Firemaw", "Flamelash", "Gandling", "Gehennas", "Golemagg", "Hydraxian Waterlords", "Judgement", "Mirage Raceway", "Mograine", "Nethergarde Keep", "Noggenfogger", "Pyrewood Village", "Razorgore", "Shazzrah", "Skullflame", "Stonespine", "Ten Storms", "Zandalar Tribe"],
  ...['Sulfuron', 'Amnennar', 'Auberdine', 'Finkle',], // EU-FR
  ...["Celebras", "Dragon's Call", "Everlook", "Heartstriker", "Lakeshire", "Lucifron", "Patchwerk", "Razorfen", "Transcendence", "Venoxis"], // EU-DE
  ...["Mandokir"], // EU-ES
  ...["Пламегор", "Хроми", "Рок-Делар", "Змейталак", "Вестник Рока",] // EU-RU
]
const krRegion = ["로크홀라", "라그나로스", "얼음피", "소금 평원", "힐스브래드",]
const twRegion = ["伊弗斯", "瑪拉頓"]
usRegion.forEach(region => regionDic[region] = "US")
euRegion.forEach(region => regionDic[region] = "EU")
krRegion.forEach(region => regionDic[region] = "KR")
twRegion.forEach(region => regionDic[region] = "TW")
const getLogMeta = async (accessToken, raidLogId) => {
  var options = {
    method: 'POST',
    url: 'https://classic.warcraftlogs.com/api/v2/client',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    data: {
      query : 
       `{
        reportData {
          report(code: "${raidLogId}") {  
            region {
              slug
              name
              compactName
            }
            title
            zone {
              name
            }
            masterData {
              actors {
                server
                subType
              }
            }
          }
        }  
      }`
    }
  }

  const res = await axios.request(options)
  if ('errors' in res.data) {
    return
  }

  const tmp = res.data.data.reportData.report
  
  const classes = tmp.masterData.actors
    .map(actor => actor.subType)
  const faction = classes.includes("Paladin") ? "Alliance" : classes.includes("Shaman") ? "Horde" : "Unknown"
  const serverCandidates = tmp.masterData.actors
    .map(actor => actor.server)
    .filter(server => server)
    .reduce((acc, server) => {
      if (!(server in acc)) {
        acc[server] = 0
      }
      acc[server]++
      return acc
    }, {})
  const server = Object.entries(serverCandidates).sort((x, y) => y[1] - x[1])[0][0]
  const region = tmp.region != undefined ? tmp.region.slug: server in regionDic ? regionDic[server] : "CN"

  const logMeta = {
    title: tmp.title,
    zone: tmp.zone.name,
    region: region,
    server: server,
    faction: faction,
  }

  return logMeta
}

const getConsumed = async (accessToken, raidLogId, abilityList, protectionList) => {
  const abilityQL = abilityList
    .map(abilityId => {
      return `a${abilityId}: events(
        startTime: 0, endTime: 100000000, 
        dataType: Casts, abilityID: ${abilityId}
      ) { data }
      `
    })
    .join('') + protectionList
    .map(protectionId => {
      return `b${protectionId}: events(
        startTime: 0, endTime: 100000000, 
        dataType: Buffs, abilityID: ${protectionId}
      ) { data }
      `
    })
    .join('')


  var options = {
    method: 'POST',
    url: 'https://classic.warcraftlogs.com/api/v2/client',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      query:
      `{
        reportData {
          report(code: "${raidLogId}") {
            ${abilityQL}
          }    
        }
      }`
    }      
  };

  const res = await axios.request(options)
  const tmp = res.data.data.reportData.report
  
  return Object.keys(tmp)
    .map(key => {
      const type = key[0]
      const guid = parseInt(key.substring(1))
      if (type == 'a') {
        return {
          guid: guid,
          totalUses: tmp[key].data.length
        }
      } else if (type == 'b') {
        const obj = tmp[key].data
        const dic = obj
          .reduce((acc, event) => {
            if (!(event.sourceID in acc)) {
              acc[event.sourceID] = 0
            }
            acc[event.sourceID]++
            return acc
          }, {})

        const cnt = Object.values(dic)
          .reduce((acc, value) => {
            acc += value == 1 ? value : (value - 1)      
            return acc
          }, 0)

        return {
          guid: guid,
          totalUses: cnt
        }
      }
    })
}

const abilities = {
  DaemonicRunes: 16666,
  DarkRunes: 27869,
  MajorMana: 17531,
  MajorHealing: 17534,
  GoblinSapperCharge: 13241,
  ElementalSharpening: 22756,
  DenseSharpening: 16138,
  LimitedInvulnerability: 3169,
  DenseDynamite: 23063,
  ThoriumGrenade: 19769,
  DenseWeightstone: 16622,
  Rejuvenation: 22729,
  MightyRage: 17528,
  Immolation: 11350,
}
const protections = {
  greaterFireProtection: 17543,
  greaterFrostProtection: 17544,
  frostProtection: 7239,
  greaterNatureProtection: 17546,
  natureProtection: 7254,
  greaterShadowProtection: 17548,
  shadowProtection: 7242,
  greaterArcaneProtection: 17549
}
const abilityList = Object.values(abilities)
const protectionList = Object.values(protections)

const getAllItems = async (raidLogId, logMeta) => {
  
  const exists = await existsAsync(raidLogId)
  if (exists) return {status: 'success'}

  const consumedBuffs = [
    getConsumedBuffs(accessToken, raidLogId),
    getConsumed(accessToken, raidLogId, abilityList, protectionList)
  ]

  const result = await Promise.all(consumedBuffs)
  const logObj = {
    data: result
      .flat()
      .filter(item => {
        return item.totalUses > 0
      }),
    meta: logMeta,
    raidLogId: raidLogId
  }
  client.set(raidLogId, JSON.stringify(logObj))
  
  return {status: 'success', logObj: logObj, raidLogId: raidLogId}
}

const iconDic = { 
  11334:"inv_potion_93.jpg", 24383:"inv_potion_31.jpg", 6615:"inv_potion_04.jpg", 24382:"inv_potion_30.jpg", 3593:"inv_potion_43.jpg",
  11364:"inv_potion_08.jpg", 17539:"inv_potion_25.jpg", 11349:"inv_potion_86.jpg", 17540:"inv_potion_69.jpg", 17626:"inv_potion_62.jpg",
  3223:"inv_potion_79.jpg", 22790:"inv_drink_05.jpg", 11474:"inv_potion_46.jpg", 17038:"inv_potion_92.jpg", 25804:"inv_drink_04.jpg",
  17628:"inv_potion_41.jpg", 26276:"inv_potion_60.jpg", 11348:"inv_potion_66.jpg", 17627:"inv_potion_97.jpg", 17538:"inv_potion_32.jpg",
  22789:"inv_drink_03.jpg", 11405:"inv_potion_61.jpg", 16666:"inv_misc_rune_04.jpg", 27869:"spell_shadow_sealofkings.jpg",
  17531:"inv_potion_76.jpg", 17534:"inv_potion_54.jpg", 13241:"spell_fire_selfdestruct.jpg", 22756:"inv_stone_02.jpg",
  16138:"inv_stone_sharpeningstone_05.jpg", 3169:"inv_potion_62.jpg", 23063:"inv_misc_bomb_06.jpg",
  19769:"spell_fire_selfdestruct.jpg", 16622:"inv_stone_weightstone_05.jpg", 22729:"inv_potion_47.jpg", 24361: "inv_potion_80.jpg",
  17624: "inv_potion_26.jpg", 11390: "inv_potion_30.jpg", 24364: "inv_potion_07.jpg", 17528: "inv_potion_41.jpg",
  11392: "inv_potion_25.jpg", 3222: "inv_potion_78.jpg", 3220: "inv_potion_64.jpg", 21920: "inv_potion_03.jpg",
  17546: "inv_potion_22.jpg", 17543: "inv_potion_24.jpg", 17548: "inv_potion_23.jpg", 17549: "inv_potion_83.jpg", 17544: "inv_potion_20.jpg",
  24417: "inv_potion_29.jpg", 11350: "inv_potion_11.jpg", 7239: "inv_potion_13.jpg", 7254: "inv_potion_06.jpg", 7242: "inv_potion_44.jpg",
  7844: "inv_potion_33.jpg", 22807: "inv_potion_05.jpg", 3680: "inv_potion_18.jpg"
}
const itemIdDic = {
  17528:13442, 11334:9187, 11348:13445, 11390:9155, 17628:13512, 17627:13511,
  25804:21151, 3220:3389, 17539:13454, 24364:20008, 6615:5634, 22729:18253,
  3222:3388, 3223:3826, 26276:21546, 11349:8951, 17626:13510, 17531:13444,
  23063:18641, 19769:15993, 17538:13452, 22756:18262, 24361:20004, 11405:9206,
  13241:10646, 11392:9172, 17534:13446, 22789:18269, 17038:12820,
  16138:12404, 16666:12662, 27869:20520, 24383:20081, 16622:12643,
  3169:3387, 17540:13455, 11474:9264, 24382:20079, 11364:9036,
  17624:13506, 22790:18284, 3593:3825, 17546:13458, 17543:13457,
  17548:13459, 17549:13461, 17544:13456, 11350:8956, 7239: 6050,
  7254: 6052, 7242: 6048, 7844: 6373, 22807: 18294, 3680: 3823,
  24417: 20080
}
const toGUID = Object.entries(itemIdDic).reduce((acc, tar) => { acc[tar[1]] = tar[0]; return acc }, {})

const getItemPrice = async (logObj, locale) => {
  for (var i = 0; i < logObj.data.length; i++) {
    logObj.data[i]['icon'] = iconDic[logObj.data[i]['guid']] ? iconDic[logObj.data[i]['guid']] : logObj.data[i]['guid'] + '_notfound.jpg'
  }

  const itemIds = logObj.data
    .map(e => {
      return itemIdDic[e.guid]
    })
    .filter(e => e)
    .join(',')    

  let cnx = await pool.getConnection()
  let rows = await cnx.query(`
    SELECT * 
    FROM auctionItem 
    WHERE itemId in (${itemIds}) 
    AND slug = "${logObj.meta.server}" 
    AND faction = "${logObj.meta.faction}" 
  `);

  let tmp = {}    
  rows
    .forEach(row => {
      tmp[parseInt(toGUID[row.itemId])] = row
    })    
  cnx.close()


  logObj.data
    .forEach(item => {
      item.name = locale in itemLocaleDic && item.guid in itemLocaleDic[locale] ? itemLocaleDic[locale][item.guid] : item.guid
      if (item.guid in tmp) {
        item.buyout = tmp[item.guid].buyout
        item.ts = tmp[item.guid+ ''].ts
      } else {
        item.buyout = 'N/A'
        item.ts = 'N/A'
      }
    })

  logObj.total = logObj.data
    .filter(item => {
      return 'buyout' in item && item.buyout > 0
    })
    .reduce((acc, item) => {
      return acc + (item.buyout * item.totalUses)
    }, 0)

  return logObj
}

const getData = async (raidLogId, locale) => {
  const exists = await existsAsync(raidLogId)
  let logObj
  if (exists) {
    logObj = JSON.parse(await getAsync(raidLogId))
  }
  else {
    const valid = await checkVisibility(raidLogId)
    if (!valid) return valid

    const logMeta = await getLogMeta(accessToken, raidLogId)
    const result = await getAllItems(raidLogId, logMeta)

    logObj = result.logObj
  }
  const finalLogData = await getItemPrice(logObj, locale)
  return finalLogData
}

const getBearerToken = async _ => {
  const res = await axios.post(url, params, authKey)
  return res.data.access_token
}

const init = async _ => {
  accessToken = await getBearerToken()
  return accessToken
}

init()
  .then(accessToken => {
    console.log(`OK: ${accessToken.length}`)
  })
  .catch(err => {
    console.error(`error: ${err.data}`)
  })

module.exports = { checkVisibility, getAllItems, getData }