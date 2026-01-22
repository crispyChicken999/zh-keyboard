import PinyinMatch from 'pinyin-match'

// 词库数据类型


type WordDict = Record<string, [string, number, string]>

export class WordMatcher {
  private wordDict: WordDict = {}
  private wordList: Array<{ word: string; pinyin: string; frequency: number }> = []
  private initialized = false

  async initialize() {
    if (this.initialized) return

    console.log('开始加载词库...')
    try {
      // 从 public 目录加载词库（使用 modern.json 以提升性能）
      console.log('正在请求 /modern.json...')
      const response = await fetch('/modern.json')
      console.log('响应状态:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      this.wordDict = await response.json()

      // 转换为数组格式，方便匹配和排序
      this.wordList = Object.entries(this.wordDict).map(([word, entry]) => ({
        word,
        pinyin: this.normalizePinyin(entry[0]), // 去除声调
        frequency: entry[1],
      }))

      // 按词频排序（频率高的在前）
      this.wordList.sort((a, b) => b.frequency - a.frequency)

      this.initialized = true
      console.log(`词库加载完成，共 ${this.wordList.length} 个词`)
    } catch (error) {
      console.error('加载词库失败:', error)
    }
  }

  // 去除拼音声调
  private normalizePinyin(pinyin: string): string {
    return pinyin
      .toLowerCase()
      .replace(/[āáǎà]/g, 'a')
      .replace(/[ēéěè]/g, 'e')
      .replace(/[īíǐì]/g, 'i')
      .replace(/[ōóǒò]/g, 'o')
      .replace(/[ūúǔù]/g, 'u')
      .replace(/[ǖǘǚǜü]/g, 'v')
      .replace(/\s+/g, '') // 移除空格
  }

  // 匹配拼音输入
  matchWords(input: string, maxResults: number = 30): string[] {
    if (!this.initialized || !input) return []

    const normalizedInput = input.toLowerCase().trim()
    const results: Array<{ word: string; frequency: number; matchQuality: number }> = []

    for (const item of this.wordList) {
      // 使用 pinyin-match 进行匹配
      const match = PinyinMatch.match(item.word, normalizedInput)

      if (match !== false) {
        // 计算匹配质量
        const matchQuality = this.calculateMatchQuality(
          item.word,
          item.pinyin,
          normalizedInput,
        )

        results.push({
          word: item.word,
          frequency: item.frequency,
          matchQuality,
        })

        // 限制匹配数量以提高性能
        if (results.length >= maxResults * 3) break
      }
    }

    // 按匹配质量和词频排序
    results.sort((a, b) => {
      // 先按匹配质量排序
      if (a.matchQuality !== b.matchQuality) {
        return b.matchQuality - a.matchQuality
      }
      // 匹配质量相同时按词频排序
      return b.frequency - a.frequency
    })

    return results.slice(0, maxResults).map(r => r.word)
  }

  // 计算匹配质量（0-100）
  private calculateMatchQuality(
    word: string,
    pinyin: string,
    input: string,
  ): number {
    let quality = 50 // 基础分数

    // 完全匹配拼音
    if (pinyin === input) {
      quality += 40
    }
    // 拼音前缀匹配
    else if (pinyin.startsWith(input)) {
      quality += 30
    }
    // 部分匹配
    else {
      quality += 10
    }

    // 词长度越短，质量越高（更可能是用户想要的）
    quality += Math.max(0, 20 - word.length * 2)

    return quality
  }
}

// 单例
let wordMatcherInstance: WordMatcher | null = null

export function getWordMatcher(): WordMatcher {
  if (!wordMatcherInstance) {
    wordMatcherInstance = new WordMatcher()
  }
  return wordMatcherInstance
}
