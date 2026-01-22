<script setup lang="ts">
import type { KeyEvent } from '../types'
import { useElementSize } from '@vueuse/core'
import { CanvasDrawer, createKeyRepeater } from '@zh-keyboard/core'
import { nextTick, onUnmounted, ref, watchEffect } from 'vue'
import { getHandwritingRecognizer } from '../utils/handwriting'
import CandidateList from './CandidateList.vue'
import '../styles/HandwritingInput.scss'

const props = defineProps<{
  recognizerInitialized: boolean
  recognizerProgress: number
}>()

const emit = defineEmits<{
  (e: 'key', payload: KeyEvent): void
  (e: 'exit', payload: void): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
let canvasDrawer: CanvasDrawer | null = null
// 是否正在识别中
const isRecognizing = ref(false)

// 使用useElementSize获取容器尺寸
const { height: canvasSize } = useElementSize(containerRef)

function clearCanvas() {
  if (!canvasDrawer)
    return
  canvasDrawer.clearCanvas()
}

function setupCanvas() {
  if (!canvasRef.value)
    return

  // 如果已存在画布处理器，先销毁它
  if (canvasDrawer) {
    canvasDrawer.destroy()
  }

  canvasDrawer = new CanvasDrawer(canvasRef.value, {
    onDrawEnd: () => {
      // 清除之前的定时器
      if (recognitionTimer) {
        clearTimeout(recognitionTimer)
      }
      // 设置新的延迟识别
      recognitionTimer = setTimeout(() => {
        recognizeStroke()
      }, RECOGNITION_DELAY)
    },
  })
}

const candidates = ref<string[]>([])
const lastInputChar = ref<string | null>(null)

// 为侧边按钮添加重复功能
const repeater = createKeyRepeater()

function startRepeat(e: PointerEvent, action: () => void) {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  repeater.start(action)
}

function stopRepeat() {
  repeater.stop()
}

// 识别防抖定时器
let recognitionTimer: ReturnType<typeof setTimeout> | null = null
const RECOGNITION_DELAY = 800 // 800ms 延迟

// 识别当前笔迹（带防抖）
async function recognizeStroke() {  if (!canvasDrawer || canvasDrawer.getStrokeData().length === 0 || isRecognizing.value)
    return

  const recognizer = getHandwritingRecognizer()
  if (recognizer) {
    isRecognizing.value = true

    try {
      // 将 readonly array 转换为 mutable array
      const strokeData = [...canvasDrawer.getStrokeData()]
      const results = await recognizer.recognize(strokeData)

      candidates.value = results
      
      // 自动选择第一个候选字符
      if (results.length > 0) {
        const firstCandidate = results[0]
        emit('key', { key: firstCandidate })
        lastInputChar.value = firstCandidate
      }
    } catch (error) {
      console.error('识别笔迹失败:', error)
    } finally {
      isRecognizing.value = false
    }
  } else {
    console.warn('手写识别服务不可用')
  }
}

// 组件卸载时清理识别器和定时器
onUnmounted(() => {
  if (canvasDrawer) {
    canvasDrawer.destroy()
  }
  repeater.stop()
  if (recognitionTimer) {
    clearTimeout(recognitionTimer)
  }
})

watchEffect(() => {
  if (canvasRef.value && canvasSize.value && props.recognizerInitialized) {
    nextTick(() => {
      setupCanvas()
    })
  }
})

// 处理删除键
function handleDelete() {
  // 如果有候选词，清除候选词和画布
  if (candidates.value.length > 0) {
    candidates.value = []
    lastInputChar.value = null
    clearCanvas()
  }
  
  // 同时发送删除事件到输入框
  emit('key', { key: 'delete', isControl: true })
}

function handleSelection(candidate: string) {
  // 如果有上一个字符，先删除
  if (lastInputChar.value) {
    emit('key', { key: 'delete', isControl: true })
  }
  
  // 输入新字符
  emit('key', { key: candidate })
  lastInputChar.value = candidate
  candidates.value = []
  clearCanvas()
}
</script>

<template>
  <div class="handwriting-input">
    <CandidateList
      :candidates
      @select="handleSelection"
    />
    <div ref="containerRef" class="handwriting-content">
      <div class="handwriting-buttons">
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerdown="(e) => startRepeat(e, () => emit('key', { key: '。' }))"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          。
        </button>
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerdown="(e) => startRepeat(e, () => emit('key', { key: '？' }))"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          ？
        </button>
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerdown="(e) => startRepeat(e, () => emit('key', { key: '！' }))"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          ！
        </button>
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerdown="(e) => startRepeat(e, () => emit('key', { key: ' ' }))"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          <img src="../assets/icons/keyboard-space.svg" alt="空格" />
        </button>
      </div>
      <div class="handwriting-canvas-container">
        <!-- 进度条显示 -->
        <div
          v-if="!recognizerInitialized"
          class="handwriting-loading"
          :style="{ width: `${canvasSize}px`, height: `${canvasSize}px` }"
        >
          <div class="loading-text">
            正在加载手写识别...
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${recognizerProgress * 100}%` }"></div>
          </div>
          <div class="progress-text">
            {{ Math.round(recognizerProgress * 100) }}%
          </div>
        </div>
        <!-- 画布显示 -->
        <canvas
          v-else
          ref="canvasRef"
          class="handwriting-canvas"
          :width="canvasSize"
          :height="canvasSize"
        ></canvas>
      </div>
      <div class="handwriting-buttons">
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerdown="(e) => startRepeat(e, handleDelete)"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          <img src="../assets/icons/keyboard-backspace.svg" alt="删除" />
        </button>
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerup="(e) => { e.preventDefault(); emit('exit') }"
          @contextmenu.prevent
        >
          返回
        </button>
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerdown="(e) => startRepeat(e, () => emit('key', { key: '，' }))"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          ，
        </button>
        <button
          class="handwriting-btn handwriting-btn--function"
          @pointerdown="(e) => startRepeat(e, () => emit('key', { key: 'enter', isControl: true }))"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
          @contextmenu.prevent
        >
          <img src="../assets/icons/keyboard-return.svg" alt="回车" />
        </button>
      </div>
    </div>
  </div>
</template>
