const got = require('got')
const fs = require('fs')
const Cookie = require('tough-cookie')
const { site, deluge, barkKey } = require('./config')

const siteTorrent = {}

const getNewestTorrents = async () => {
  Object.keys(site).forEach(async key => {
    const { url, path, authkey, torrentPass, cookie } = site[key]
    const res = await got(`${url}${path}`, {
      headers: {
        cookie,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
      },
      responseType: 'json'
    })
    try {
      const data = res.body
      if (data.status === 'success') {
        let newTorrent, newTorrentId, torrentName
        if (data.response.results.length > 0) {
          newTorrent = data.response.results[0]
          torrentName = newTorrent.groupName
          newTorrentId = newTorrent.torrentId || newTorrent.torrents[0].torrentId
        } else {
          throw new Error(`${key}:种子id获取失败: 暂无种子`)
        }
        if (!newTorrentId) {
          throw new Error(`${key}:种子id获取失败: ${JSON.stringify(data.response.results[0])}`)
        }
        log(`${new Date()}: ${key}:newTorrentId:${newTorrentId}|torrentId:${siteTorrent[key] || ''}`)
        if (newTorrentId && newTorrentId !== siteTorrent[key]) {
          siteTorrent[key] = newTorrentId
          let torrentUrl = `${url}/torrents.php?action=download&id=${newTorrentId}&authkey=${authkey}&torrent_pass=${torrentPass}`
          if (key === 'gpw') {
            torrentUrl += '&usetoken=1'
          }
          addTorrentsUrl(torrentUrl, torrentName)
        } else {
          log(`${new Date()}: ${key}:暂无新种子`)
        }
      }
    } catch (error) {
      log(`${new Date()}: ${key}:${error.message}`)
    }
  })
}

const addTorrentsUrl = async (url, torrentName) => {
  try {
    const res = await got(deluge.url, {
      method: 'POST',
      json: {
        method: 'auth.login',
        params: [deluge.password],
        id: '1'
      }
    })
    if (!res.headers['set-cookie'] || !res.headers['set-cookie'].length) {
      throw new Error('身份验证失败')
    }

    const cookie = Cookie.parse(res.headers['set-cookie'][0])
    if (!cookie || cookie.key !== '_session_id') {
      throw new Error('登录失败')
    }
    const auth = cookie.value
    await got(deluge.url, {
      method: 'POST',
      headers: {
        Cookie: `_session_id=${auth || ''}`
      },
      json: {
        method: 'core.add_torrent_url',
        params: [url, {
          download_location: deluge.downloadLocation,
          add_paused: false
        }],
        id: 1
      }
    })
    log(`${new Date()}: ${torrentName}:添加成功`)
    notify(torrentName)
  } catch (error) {
    log(`${new Date()}: ${error.message}`)
  }
}
const log = (str) => {
  fs.appendFileSync('./log.txt', `\n${str}`, (err) => {
    console.log(err)
  })
}
const notify = async (content) => {
  await got(`https://api.day.app/${barkKey}/种子添加成功/${content}`)
}
setInterval(async () => {
  await getNewestTorrents()
}, 15000)
