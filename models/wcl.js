const axios = require('axios')
const redis = require('redis')
const client = redis.createClient(require('../redisConfig'))
const authKey = { auth: require('../wclConfig') }
const url = 'https://classic.warcraftlogs.com/oauth/token'
const params = { grant_type: 'client_credentials' }
const { promisify } = require("util")
const existsAsync = promisify(client.exists).bind(client)
const getAsync = promisify(client.get).bind(client)
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

const getConsumedItem = async (accessToken, raidLogId, abilityID) => {
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
            events(
              startTime: 0, 
              endTime: 100000000, 
              dataType: Casts,
              abilityID: ${abilityID},
              translate: true
            ) {
              data
              nextPageTimestamp
            }
      
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
  const result = {
    guid: abilityID,
    totalUses: res.data.data.reportData.report.events.data.filter(e => e.type == 'cast').length
  }
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


const getAllItems = async raidLogId => {
  
  const exists = await existsAsync(raidLogId)
  if (exists) return {status: 'success'}

  const consumedBuffs = [getConsumedBuffs(accessToken, raidLogId)]
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
    Rejuvenation: 22729
  }

  Object.values(abilities)
    .forEach(guid => {
      consumedBuffs.push(getConsumedItem(accessToken, raidLogId, guid))
    })

  const result = await Promise.all(consumedBuffs)
  const flatResult = result
    .flat()
    .filter(item => {
      return item.totalUses > 0
    })
  client.set(raidLogId, JSON.stringify(flatResult))
  
  return {status: 'success', data: flatResult, raidLogId: raidLogId}
}

const iconDic = { 11334:"inv_potion_93.jpg", 24383:"inv_potion_31.jpg", 6615:"inv_potion_04.jpg", 24382:"inv_potion_30.jpg", 3593:"inv_potion_43.jpg", 11364:"inv_potion_08.jpg", 17539:"inv_potion_25.jpg", 11349:"inv_potion_86.jpg", 17540:"inv_potion_69.jpg", 17626:"inv_potion_62.jpg", 3223:"inv_potion_79.jpg", 22790:"inv_drink_05.jpg", 11474:"inv_potion_46.jpg", 17038:"inv_potion_92.jpg", 25804:"inv_drink_04.jpg", 17628:"inv_potion_41.jpg", 26276:"inv_potion_60.jpg", 11348:"inv_potion_66.jpg", 17627:"inv_potion_97.jpg", 17538:"inv_potion_32.jpg", 22789:"inv_drink_03.jpg", 11405:"inv_potion_61.jpg", 16666:"inv_misc_rune_04.jpg", 27869:"spell_shadow_sealofkings.jpg", 17531:"inv_potion_76.jpg", 17534:"inv_potion_54.jpg", 13241:"spell_fire_selfdestruct.jpg", 22756:"inv_stone_02.jpg", 16138:"inv_stone_sharpeningstone_05.jpg", 3169:"inv_potion_62.jpg", 23063:"inv_misc_bomb_06.jpg", 19769:"spell_fire_selfdestruct.jpg", 16622:"inv_stone_weightstone_05.jpg", 22729:"inv_potion_47.jpg", 24361: "inv_potion_80.jpg"}
const getData = async raidLogId => {
  const exists = await existsAsync(raidLogId)
  if (exists) {
    const data = JSON.parse(await getAsync(raidLogId))
    for (var i = 0; i < data.length; i++) {
      data[i]['icon'] = iconDic[data[i]['guid']] ? iconDic[data[i]['guid']] : data[i]['guid'] + '_notfound.jpg'
    }
    return {data: data, status: 'success', raidLogId: raidLogId}
  }
  else {
    try {
      const valid = await checkVisibility(raidLogId)
      if (!valid) return valid

      const result = await getAllItems(raidLogId)

      for (var i = 0; i < result.data.length; i++) {
        result.data[i]['icon'] = iconDic[result.data[i]['guid']] ? iconDic[result.data[i]['guid']] : result.data[i]['guid'] + '_notfound.jpg'
      }
      
      return result
    } catch(err) {
      console.error(`Error: ${err}`)
    }

  }
}

const getBearerToken = async _ => {
  const res = await axios.post(url, params, authKey)
  return res.data.access_token
}

const init = async _ => {
  accessToken = await getBearerToken()
  return accessToken
}

const doit = async accessToken => {
  const tmp = [{"guid":11334,"totalUses":13},{"guid":24383,"totalUses":10},{"guid":6615,"totalUses":33},{"guid":24427,"totalUses":72},{"guid":24382,"totalUses":24},{"guid":3593,"totalUses":39},{"guid":11364,"totalUses":2},{"guid":17539,"totalUses":70},{"guid":11349,"totalUses":5},{"guid":17540,"totalUses":25},{"guid":17626,"totalUses":2},{"guid":3223,"totalUses":4},{"guid":22790,"totalUses":16},{"guid":11474,"totalUses":36},{"guid":17038,"totalUses":61},{"guid":25804,"totalUses":5},{"guid":17628,"totalUses":4},{"guid":26276,"totalUses":41},{"guid":11348,"totalUses":18},{"guid":17627,"totalUses":1},{"guid":17538,"totalUses":127},{"guid":22789,"totalUses":184},{"guid":11405,"totalUses":82},{"guid":16666,"totalUses":59},{"guid":27869,"totalUses":3},{"guid":17531,"totalUses":225},{"guid":17534,"totalUses":18},{"guid":13241,"totalUses":41},{"guid":22756,"totalUses":6},{"guid":16138,"totalUses":9},{"guid":3169,"totalUses":15},{"guid":23063,"totalUses":23},{"guid":19769,"totalUses":1},{"guid":16622,"totalUses":4},{"guid":22729,"totalUses":20}]
  
  for (var i = 0; i < tmp.length; i++) {
    var guid = tmp[i].guid
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
            gameData {
              ability(id: ${guid}) {
                id
                icon
              }
            }
          }`
      }
    }

    const res = await axios.request(options)
    console.log(JSON.stringify(res.data.data.gameData.ability))

  }
}

init()
  .then(accessToken => {
    console.log(`OK: ${accessToken.length}`)
    // doit(accessToken)
  })
  .catch(err => {
    console.error(`error: ${err.data}`)
  })

module.exports = { checkVisibility, getAllItems, getData }