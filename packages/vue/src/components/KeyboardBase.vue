<script setup lang="ts">
import type { KeyEvent } from '../types'
import { createKeyRepeater } from '@crispychicken/zh-keyboard-core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CandidateBar from './CandidateBar.vue'
import '../styles/KeyboardBase.scss'

const props = defineProps<{
  enableHandwriting?: boolean
}>()

const emit = defineEmits<{
  (e: 'key', payload: KeyEvent): void
}>()

const mode = defineModel<string>({
  default: 'en',
})

const isUpperCase = ref(false)
const capsLockMode = ref<'off' | 'once' | 'lock'>('off')
const lastShiftClickTime = ref(0)
const DOUBLE_CLICK_THRESHOLD = 300 // ms

const isChineseMode = computed(() => mode.value === 'zh')

const showUpperCase = computed(() => {
  return isChineseMode.value ? true : isUpperCase.value
})

function handleSpecialKey(key: string, isControl = false) {
  emit('key', { key, isControl })
}

function handleShift() {
  if (isChineseMode.value) {
    // 在中文模式下，切换到手写输入
    mode.value = 'hand'
  } else {
    // 在英文模式下，智能大小写切换
    const now = Date.now()
    const timeSinceLastClick = now - lastShiftClickTime.value
    
    if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
      // 双击：切换锁定模式
      capsLockMode.value = capsLockMode.value === 'lock' ? 'off' : 'lock'
    } else {
      // 单击：首字母大写
      capsLockMode.value = capsLockMode.value === 'off' ? 'once' : 'off'
    }
    
    lastShiftClickTime.value = now
    isUpperCase.value = capsLockMode.value !== 'off'
  }
}

function handleSwitchToNum() {
  // 切换到数字键盘
  mode.value = 'num'
}

function handleSwitchToSymbol() {
  // 切换到符号键盘
  mode.value = 'symbol'
}

const numbersRow = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

const keyboardRows = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

const pinyin = ref('')
const candidates = ref<string[]>([])

// 监听模式变化，切换模式时清空拼音
watch(mode, (newMode, oldMode) => {
  if (oldMode === 'zh' && newMode !== 'zh') {
    pinyin.value = ''
    candidates.value = []
  }
})

const repeater = createKeyRepeater()

function startRepeat(e: PointerEvent, action: () => void) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  repeater.start(action)
}

function stopRepeat() {
  repeater.stop()
}

onBeforeUnmount(() => {
  repeater.stop()
})

function handleDelete() {
  if (mode.value === 'zh' && pinyin.value) {
    // 在中文模式下，删除拼音
    pinyin.value = pinyin.value.slice(0, -1)
    return
  }
  handleSpecialKey('delete', true)
}

function handleKeyPress(key: string) {
  if (mode.value === 'zh') {
    // 在中文模式下，输入拼音
    pinyin.value += key
    return
  }
  const outputKey = isUpperCase.value ? key.toUpperCase() : key
  handleSpecialKey(outputKey)
  
  // 如果是 'once' 模式，输入后恢复小写
  if (mode.value === 'en' && capsLockMode.value === 'once') {
    capsLockMode.value = 'off'
    isUpperCase.value = false
  }
}

function handleSpace() {
  if (mode.value === 'zh' && pinyin.value && candidates.value.length > 0) {
    // 拼音模式下有候选词，选择第一个
    handleSpecialKey(candidates.value[0])
    pinyin.value = ''
    candidates.value = []
    return
  }
  // 否则输入空格
  handleSpecialKey(' ')
}

function handleEnter() {
  if (mode.value === 'zh' && pinyin.value) {
    // 拼音模式下，输入原始拼音作为英文
    handleSpecialKey(pinyin.value)
    pinyin.value = ''
    candidates.value = []
    return
  }
  // 否则正常回车
  handleSpecialKey('enter', true)
}

function handleToggleLang() {
  mode.value = mode.value === 'zh' ? 'en' : 'zh'
}

// 计算手写按钮显示的文本
const handwritingButtonText = computed(() => {
  if (!props.enableHandwriting) {
    return '-'
  }
  return '手写'
})

// 计算手写按钮是否可点击
const isHandwritingButtonDisabled = computed(() => {
  return !props.enableHandwriting
})
</script>

<template>
  <div class="zhk-base">
    <div class="zhk-base__row">
      <CandidateBar
        v-if="mode === 'zh'"
        v-model="pinyin"
        v-model:candidates="candidates"
        @input="e => handleSpecialKey(e, false)"
      />
      <template v-else>
        <button
          v-for="(key, keyIndex) in numbersRow"

          :key="`number-${keyIndex}`"
          class="zhk-base__key zhk-base__key--letter"
          @pointerdown="(e) => startRepeat(e, () => handleKeyPress(key))"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          {{ key }}
        </button>
      </template>
    </div>

    <div v-for="(row, rowIndex) in keyboardRows" :key="`row-${rowIndex}`" class="zhk-base__row">
      <button
        v-if="rowIndex === 2"
        class="zhk-base__key zhk-base__key--function zhk-base__key--shift"
        :class="{
          'zhk-base__key--active': !isChineseMode && capsLockMode === 'lock',
          'zhk-base__key--once': !isChineseMode && capsLockMode === 'once',
          'zhk-base__key--disabled': isChineseMode && isHandwritingButtonDisabled,
        }"
        :disabled="isChineseMode && isHandwritingButtonDisabled"
        @click="handleShift"
        @contextmenu.prevent
      >
        <template v-if="isChineseMode">
          {{ handwritingButtonText }}
        </template>
        <template v-else>
          <img src="../assets/icons/keyboard-caps.svg" class="zhk-base__key-icon" alt="Shift" />
        </template>
      </button>

      <button
        v-for="(key, keyIndex) in row"
        :key="`key-${rowIndex}-${keyIndex}`"
        class="zhk-base__key zhk-base__key--letter"
        @pointerdown="(e) => startRepeat(e, () => handleKeyPress(key))"
        @pointerup="stopRepeat"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
        @contextmenu.prevent
      >
        {{ showUpperCase ? key.toUpperCase() : key }}
      </button>

      <button
        v-if="rowIndex === 2"
        class="zhk-base__key zhk-base__key--function zhk-base__key--delete"
        @pointerdown="(e) => startRepeat(e, () => handleDelete())"
        @pointerup="stopRepeat"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
        @contextmenu.prevent
      >
        <img src="../assets/icons/keyboard-backspace.svg" class="zhk-base__key-icon" alt="Delete" />
      </button>
    </div>

    <div class="zhk-base__row">
      <button class="zhk-base__key zhk-base__key--function" @click="handleSwitchToSymbol" @contextmenu.prevent>
        符
      </button>
      <button class="zhk-base__key zhk-base__key--function" @click="handleSwitchToNum" @contextmenu.prevent>
        123
      </button>
      <button
        class="zhk-base__key"
        @pointerdown="(e) => startRepeat(e, () => handleSpecialKey(','))"
        @pointerup="stopRepeat"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
        @contextmenu.prevent
      >
        ，
      </button>
      <button
        class="zhk-base__key zhk-base__key--space"
        @pointerdown="(e) => startRepeat(e, () => handleSpace())"
        @pointerup="stopRepeat"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
        @contextmenu.prevent
      >
        <img src="../assets/icons/keyboard-space.svg" class="zhk-base__key-icon" alt="Space" />
      </button>
      <button
        class="zhk-base__key"
        @pointerdown="(e) => startRepeat(e, () => handleSpecialKey('。'))"
        @pointerup="stopRepeat"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
        @contextmenu.prevent
      >
        。
      </button>
      <button class="zhk-base__key zhk-base__key--function" @click="handleToggleLang" @contextmenu.prevent>
        <span class="zhk-base__toggle-main">{{ mode === 'zh' ? '中' : '英' }}</span>
        <span class="zhk-base__toggle-sub">/{{ mode === 'zh' ? '英' : '中' }}</span>
      </button>
      <button
        class="zhk-base__key zhk-base__key--function"
        @pointerdown="(e) => startRepeat(e, () => handleEnter())"
        @pointerup="stopRepeat"
        @pointerleave="stopRepeat"
        @pointercancel="stopRepeat"
        @contextmenu.prevent
      >
        <img src="../assets/icons/keyboard-return.svg" class="zhk-base__key-icon" alt="Enter" />
      </button>
    </div>
  </div>
</template>
