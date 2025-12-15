<template>
  <div class="meme-generator">
    <el-container class="main-container">
      <!-- Left Panel -->
      <el-aside width="400px" class="left-panel">
        <el-card class="neu-card">
          <template #header>
            <div class="card-header">
              <span class="header-title">配置</span>
            </div>
          </template>
          
          <el-form label-position="top">
            <el-form-item label="主题关键词">
              <el-input v-model="subject" placeholder="输入主题 (例如: 股票)" class="neu-input" />
            </el-form-item>

            <el-form-item label="参考角色图">
              <el-upload
                class="upload-demo"
                action="#"
                :auto-upload="false"
                :on-change="handleFileChange"
                :limit="1"
                :file-list="fileList"
                list-type="picture"
              >
                <el-button class="neu-button secondary">选择图片</el-button>
                <template #tip>
                  <div class="el-upload__tip">
                    jpg/png 文件，大小不超过 500kb
                  </div>
                </template>
              </el-upload>
            </el-form-item>

            <el-button 
              class="neu-button primary generate-btn" 
              @click="handleGenerate" 
              :loading="loading"
              :disabled="!subject || !uploadedFile"
            >
              开始生成
            </el-button>

            <el-alert
              v-if="error"
              :title="error"
              type="error"
              show-icon
              class="error-alert neu-alert"
              @close="error = ''"
            />
          </el-form>
        </el-card>
      </el-aside>

      <!-- Right Panel -->
      <el-main class="right-panel">
        <el-card class="result-card neu-card">
          <template #header>
            <div class="card-header">
              <span class="header-title">结果与切割</span>
              <div class="controls" v-if="resultUrl">
                <el-button class="neu-button small" size="small" @click="addHLine">添加水平线</el-button>
                <el-button class="neu-button small" size="small" @click="addVLine">添加垂直线</el-button>
                <el-button class="neu-button success small" size="small" @click="sliceAndDownload">切割并下载</el-button>
              </div>
            </div>
          </template>

          <div class="image-container-wrapper">
            <div class="image-container" v-if="resultUrl">
              <img :src="resultUrl" ref="resultImage" class="result-image" @load="initSlicing" crossorigin="anonymous"/>
              
              <!-- Horizontal Lines -->
              <div
                v-for="(line, index) in hLines"
                :key="'h-' + index"
                class="line h-line"
                :style="{ top: line + 'px' }"
                @mousedown="startDrag('h', index, $event)"
              >
                <div class="line-handle"></div>
              </div>

              <!-- Vertical Lines -->
              <div
                v-for="(line, index) in vLines"
                :key="'v-' + index"
                class="line v-line"
                :style="{ left: line + 'px' }"
                @mousedown="startDrag('v', index, $event)"
              >
                <div class="line-handle"></div>
              </div>
            </div>
            
            <div v-else class="placeholder">
              <el-empty description="生成的图片将显示在这里" />
            </div>
          </div>
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import axios from 'axios'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { ElMessage } from 'element-plus'

const subject = ref('')
const fileList = ref<any[]>([])
const uploadedFile = ref<File | null>(null)
const uploadedUrl = ref('')
const resultUrl = ref('')
const loading = ref(false)
const error = ref('')

const resultImage = ref<HTMLImageElement | null>(null)

// Slicing State
const hLines = ref<number[]>([])
const vLines = ref<number[]>([])
const dragging = reactive({
  active: false,
  type: '' as 'h' | 'v',
  index: -1
})

const handleFileChange = (file: any) => {
  uploadedFile.value = file.raw
  fileList.value = [file]
  // Reset previous state
  uploadedUrl.value = ''
  resultUrl.value = ''
  error.value = ''
}

const uploadImage = async () => {
  if (!uploadedFile.value) return null
  
  const formData = new FormData()
  formData.append('image', uploadedFile.value)

  try {
    const response = await axios.post('https://img.scdn.io//api/v1.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    if (response.data && response.data.success) {
      return response.data.url
    } else {
      throw new Error('上传失败')
    }
  } catch (err: any) {
    throw new Error('图片上传失败: ' + err.message)
  }
}

const handleGenerate = async () => {
  loading.value = true
  error.value = ''
  hLines.value = []
  vLines.value = []
  
  try {
    // 1. Upload Image
    if (!uploadedUrl.value) {
      const url = await uploadImage()
      if (url) {
        uploadedUrl.value = url
      } else {
        throw new Error('获取上传图片URL失败')
      }
    }

    // 2. Generate Image
    const prompt = `为我生成图中角色的绘制 Q 版的，LINE 风格的半身像表情包，注意头饰要正确，彩色手绘风格，使用 4x6 布局，涵盖各种各样的关于【${subject.value}】的语句，或是一些有关【${subject.value}】的 meme，其他需求：不要原图复制。所有标注为手写简体中文。`
    
    const response = await fetch('https://grsai.dakka.com.cn/v1/draw/nano-banana', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-b7182e2c0c3248b6aafcedad465af768'
      },
      body: JSON.stringify({
        model: 'nano-banana-pro-vt',
        prompt: prompt,
        aspectRatio: '16:9',
        imageSize: '1K',
        urls: [uploadedUrl.value]
      })
    })

    if (!response.ok) {
      throw new Error(`生成API错误: ${response.status} ${response.statusText}`)
    }

    if (!response.body) throw new Error('不支持流式传输。')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.substring(5).trim()
          if (!jsonStr) continue
          
          try {
            const data = JSON.parse(jsonStr)
            if (data.results && data.results.length > 0) {
              resultUrl.value = data.results[0].url
            }
            if (data.status === 'failed') {
               throw new Error(data.failure_reason || data.error || '生成失败')
            }
          } catch (e) {
            console.warn('Parse error for chunk:', jsonStr, e)
          }
        }
      }
    }
    
    // Handle any remaining buffer
    if (buffer.startsWith('data:')) {
      const jsonStr = buffer.substring(5).trim()
      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr)
          if (data.results && data.results.length > 0) {
            resultUrl.value = data.results[0].url
          }
        } catch (e) {
          console.warn('Parse error for final chunk:', jsonStr, e)
        }
      }
    }

  } catch (err: any) {
    error.value = err.message
    console.error(err)
  } finally {
    loading.value = false
  }
}

// Slicing Logic
const initSlicing = () => {
  // Initialize default lines if needed, or just wait for user
}

const addHLine = () => {
  if (!resultImage.value) return
  hLines.value.push(resultImage.value.clientHeight / 2)
}

const addVLine = () => {
  if (!resultImage.value) return
  vLines.value.push(resultImage.value.clientWidth / 2)
}

const startDrag = (type: 'h' | 'v', index: number, event: MouseEvent) => {
  event.preventDefault()
  dragging.active = true
  dragging.type = type
  dragging.index = index
  
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

const onDrag = (event: MouseEvent) => {
  if (!dragging.active || !resultImage.value) return
  
  const rect = resultImage.value.getBoundingClientRect()
  
  if (dragging.type === 'h') {
    let y = event.clientY - rect.top
    // Clamp
    y = Math.max(0, Math.min(y, rect.height))
    hLines.value[dragging.index] = y
  } else {
    let x = event.clientX - rect.left
    // Clamp
    x = Math.max(0, Math.min(x, rect.width))
    vLines.value[dragging.index] = x
  }
}

const stopDrag = () => {
  dragging.active = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

const sliceAndDownload = async () => {
  if (!resultImage.value) return

  const img = resultImage.value
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight
  const displayWidth = img.clientWidth
  const displayHeight = img.clientHeight
  
  const scaleX = naturalWidth / displayWidth
  const scaleY = naturalHeight / displayHeight
  
  // Sort lines and add boundaries
  const sortedHLines = [...hLines.value].sort((a, b) => a - b).map(y => y * scaleY)
  const sortedVLines = [...vLines.value].sort((a, b) => a - b).map(x => x * scaleX)
  
  const yPoints = [0, ...sortedHLines, naturalHeight]
  const xPoints = [0, ...sortedVLines, naturalWidth]
  
  const zip = new JSZip()
  let count = 0
  
  // Canvas for slicing
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Need to load the image into a new Image object to ensure we can draw it
  // (though the img element might work if CORS is handled)
  const sourceImage = new Image()
  sourceImage.crossOrigin = "Anonymous"
  sourceImage.src = resultUrl.value
  
  await new Promise((resolve, reject) => {
    sourceImage.onload = resolve
    sourceImage.onerror = reject
  })
  
  for (let i = 0; i < yPoints.length - 1; i++) {
    for (let j = 0; j < xPoints.length - 1; j++) {
      const x = xPoints[j]!
      const y = yPoints[i]!
      const w = xPoints[j+1]! - x
      const h = yPoints[i+1]! - y
      
      if (w <= 0 || h <= 0) continue
      
      canvas.width = w
      canvas.height = h
      ctx.drawImage(sourceImage, x, y, w, h, 0, 0, w, h)
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (blob) {
        zip.file(`slice_${i}_${j}.png`, blob)
        count++
      }
    }
  }
  
  if (count > 0) {
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, `meme_slices_${Date.now()}.zip`)
    ElMessage.success('开始下载！')
  } else {
    ElMessage.warning('未生成切割图片')
  }
}
</script>

<style scoped>
/* Neu-Brutalism Variables */
:root {
  --neu-border: 3px solid #000;
  --neu-shadow: 4px 4px 0px 0px #000;
  --neu-radius: 0px;
  --neu-bg: #fff;
  --neu-primary: #FFEB3B; /* Yellow */
  --neu-secondary: #00BCD4; /* Cyan */
  --neu-success: #4CAF50; /* Green */
  --neu-danger: #F44336; /* Red */
}

.meme-generator {
  background-color: #f0f0f0;
  min-height: 100vh;
  font-family: 'Courier New', Courier, monospace; /* Monospace for brutalist feel */
}

.main-container {
  height: 100vh;
  padding: 20px;
}

.left-panel {
  padding-right: 20px;
}

.right-panel {
  padding: 0;
  height: 100%;
  overflow: hidden;
}

/* Neu-Brutalism Card */
.neu-card {
  border: 3px solid #000 !important;
  box-shadow: 4px 4px 0px 0px #000 !important;
  border-radius: 0 !important;
  background-color: #fff;
  transition: all 0.2s ease;
}

.neu-card :deep(.el-card__header) {
  border-bottom: 3px solid #000 !important;
  background-color: #FFEB3B; /* Header background */
  padding: 15px 20px;
}

.header-title {
  font-weight: 900;
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.result-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.result-card :deep(.el-card__header) {
  background-color: #00BCD4; /* Different header color for result */
}

.result-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #fff;
  padding: 20px;
  position: relative;
}

.image-container-wrapper {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

/* Neu-Brutalism Inputs */
:deep(.el-input__wrapper) {
  border: 2px solid #000 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 5px 10px;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 4px 4px 0px 0px #000 !important;
}

/* Neu-Brutalism Buttons */
.neu-button {
  border: 2px solid #000 !important;
  border-radius: 0 !important;
  box-shadow: 3px 3px 0px 0px #000 !important;
  color: #000 !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  transition: all 0.1s ease !important;
}

.neu-button:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0px 0px #000 !important;
}

.neu-button.primary {
  background-color: #FFEB3B !important;
}

.neu-button.primary:hover {
  background-color: #FFF176 !important;
}

.neu-button.secondary {
  background-color: #fff !important;
}

.neu-button.secondary:hover {
  background-color: #f0f0f0 !important;
}

.neu-button.success {
  background-color: #4CAF50 !important;
  color: #fff !important;
}

.neu-button.success:hover {
  background-color: #66BB6A !important;
}

.neu-button.small {
  padding: 8px 15px !important;
  font-size: 12px !important;
}

/* Neu-Brutalism Alert */
.neu-alert {
  border: 2px solid #000;
  border-radius: 0;
  background-color: #FFCDD2 !important; /* Light Red */
  color: #000 !important;
  box-shadow: 3px 3px 0px 0px #000;
}

.image-container {
  position: relative;
  border: 3px solid #000;
  box-shadow: 4px 4px 0px 0px #000;
  display: inline-block;
  max-width: 100%;
  background: #fff;
}

.result-image {
  display: block;
  max-width: 100%;
  max-height: 80vh;
  user-select: none;
  -webkit-user-drag: none;
}

.line {
  position: absolute;
  background-color: #000; /* Black lines for Brutalism */
  z-index: 10;
}

.h-line {
  left: 0;
  right: 0;
  height: 4px; /* Thicker lines */
  cursor: ns-resize;
  border-top: 1px solid #fff; /* Contrast */
  border-bottom: 1px solid #fff;
}

.v-line {
  top: 0;
  bottom: 0;
  width: 4px; /* Thicker lines */
  cursor: ew-resize;
  border-left: 1px solid #fff;
  border-right: 1px solid #fff;
}

.line:hover {
  background-color: #FF4081; /* Highlight color */
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.generate-btn {
  width: 100%;
  margin-top: 20px;
  height: 50px;
  font-size: 18px;
}

.error-alert {
  margin-top: 20px;
}

.placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}
</style>
