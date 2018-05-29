export default function (archive, opts) {
  opts = opts || {}
  var size = {
    total: {
      downloaded: 0,
      expected: 0
    },
    byKey: {}
  }

  archive.feeds.forEach((feed) => {
    // init
    const key = feed.key.toString('hex')
    console.log(feed)
    size.byKey[key] = {
      downloaded: feed.downloaded(),
      expected: feed.length
    }
    console.log(size.byKey[key].downloaded, '/', size.byKey[key].expected)
    size.total.downloaded += size.byKey[key].downloaded
    size.total.expected += size.byKey[key].expected
    // set updater
    feed.on('download', function (block, data) {
      size.total.downloaded += 1
      size.byKey[key].downloaded += 1
      size.byKey[key].expected = feed.length
    })
  })

  Object.defineProperty(size, 'totalPercentage', {
    get: function () {
      if (!this.empty) {
        const p = (this.total.downloaded / this.total.expected) * 100
        return (p > 100) ? 100 : p
      }
      return 0
    }
  })

  Object.defineProperty(size, 'empty', {
    get: function () {
      return this.total.expected <= 1
    }
  })

  return size
}
