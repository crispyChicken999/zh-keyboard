<script setup lang="ts">
import type { KeyEvent } from '../types'
import { AdvancedPinyinEngine } from '@crispychicken/zh-keyboard-core'
import { computed, onMounted, ref, watchEffect } from 'vue'
import { getWordMatcher } from '../utils/wordMatcher'
import CandidateList from './CandidateList.vue'
import CandidateSelection from './CandidateSelection.vue'
import '../styles/CandidateBar.scss'

const emit = defineEmits<{
  (e: 'key', payload: KeyEvent): void
  (e: 'input', text: string): void
}>()

const currentPinyin = defineModel<string>({
  required: true,
})

const candidatesModel = defineModel<string[]>('candidates', {
  default: () => [],
})

// 拼音输入法引擎
const inputEngine = new AdvancedPinyinEngine()

// 词库匹配器
const wordMatcher = getWordMatcher()

// 初始化词库
onMounted(async () => {
  await wordMatcher.initialize()
})

// 候选词列表
const candidates = ref<string[]>([])

watchEffect(async () => {
  const input = currentPinyin.value
  
  if (!input) {
    candidates.value = []
    candidatesModel.value = []
    return
  }
  
  // 检查是否包含单引号（手动分词标记）
  if (input.includes("'")) {
    // 手动分词模式
    const segments = input.split("'").filter(s => s.length > 0)
    const results: string[] = []
    
    // 为每个分段获取候选词
    const segmentCandidates: string[][] = []
    for (const segment of segments) {
      const segCandidates = await inputEngine.processInput(segment)
      segmentCandidates.push(segCandidates.slice(0, 5))
    }
    
    // 生成组合候选词
    if (segmentCandidates.length > 0 && segmentCandidates.every(arr => arr.length > 0)) {
      function generateCombinations(arrays: string[][], index: number = 0, current: string = ''): string[] {
        if (index === arrays.length) {
          return [current]
        }
        
        const result: string[] = []
        const maxCandidates = index === 0 ? 5 : 3
        for (let i = 0; i < Math.min(maxCandidates, arrays[index].length); i++) {
          const combinations = generateCombinations(arrays, index + 1, current + arrays[index][i])
          result.push(...combinations)
        }
        return result
      }
      
      results.push(...generateCombinations(segmentCandidates))
    }
    
    // 如果没有候选词，添加原始拼音
    if (results.length === 0) {
      results.push(input)
    }
    
    candidates.value = results.slice(0, 30)
  } else {
    // 自动模式：同时使用词库匹配和单字匹配
    const wordMatches = wordMatcher.matchWords(input, 20) // 词库匹配
    const charMatches = await inputEngine.processInput(input) // 单字匹配
    
    // 合并结果，词组优先
    const combined = [...wordMatches]
    
    // 添加单字候选（去重）
    for (const char of charMatches) {
      if (!combined.includes(char)) {
        combined.push(char)
      }
    }
    
    // 如果没有任何候选词，将当前拼音作为候选
    if (combined.length === 0) {
      candidates.value = [input]
    } else {
      candidates.value = combined.slice(0, 30)
    }
  }
  
  // 同步到父组件
  candidatesModel.value = candidates.value
})

const visibleCandidates = computed(() => candidates.value.slice(0, 30))

const isSelectionOpen = ref(false)

// 选择候选词
function handleSelection(selected: string) {
  inputEngine.selectCandidate(selected)
  emit('input', selected)
  currentPinyin.value = ''
  isSelectionOpen.value = false
}
</script>

<template>
  <div class="zhk-candidate">
    <div class="zhk-candidate__container">
      <!-- 输入拼音显示 -->
      <div v-if="currentPinyin" class="zhk-candidate__pinyin">
        {{ currentPinyin }}
      </div>

      <div class="zhk-candidate__bottom-container">
        <!-- 候选词列表 -->
        <CandidateList
          v-if="candidates.length > 0"
          :candidates="visibleCandidates"
          @select="handleSelection"
        />
        <button
          v-if="candidates.length > 0"
          class="zhk-candidate__more"
          @click="isSelectionOpen = true"
        >
          <img src="../assets/icons/chevron-right.svg" alt="更多" />
        </button>
      </div>
    </div>
    <CandidateSelection
      v-show="isSelectionOpen"
      :candidates="candidates"
      @select="handleSelection"
      @close="isSelectionOpen = false"
    />
  </div>
</template>
