<template>
  <div class="meme-generator">
    <el-container class="main-container">
      <!-- Left Panel -->
      <el-aside width="400px" class="left-panel">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>Configuration</span>
            </div>
          </template>
          
          <el-form label-position="top">
            <el-form-item label="Subject Keyword">
              <el-input v-model="subject" placeholder="Enter subject (e.g., Cat)" />
            </el-form-item>

            <el-form-item label="Reference Character Image">
              <el-upload
                class="upload-demo"
                action="#"
                :auto-upload="false"
                :on-change="handleFileChange"
                :limit="1"
                :file-list="fileList"
                list-type="picture"
              >
                <el-button type="primary">Select Image</el-button>
                <template #tip>
                  <div class="el-upload__tip">
                    jpg/png files with a size less than 500kb
                  </div>
                </template>
              </el-upload>
            </el-form-item>

            <el-button 
              type="primary" 
              class="generate-btn" 
              @click="handleGenerate" 
              :loading="loading"
              :disabled="!subject || !uploadedFile"
            >
              Start Generating
            </el-button>

            <el-alert
              v-if="error"
              :title="error"
              type="error"
              show-icon
              class="error-alert"
              @close="error = ''"
            />
          </el-form>
        </el-card>
      </el-aside>

      <!-- Right Panel -->
      <el-main class="right-panel">
        <el-card class="result-card">
          <template #header>
            <div class="card-header">
              <span>Result & Slicing</span>
              <div class="controls" v-if="resultUrl">
                <el-button size="small" @click="addHLine">Add H-Line</el-button>
                <el-button size="small" @click="addVLine">Add V-Line</el-button>
                <el-button size="small" type="success" @click="sliceAndDownload">Slice & Download</el-button>
              </div>
            </div>
          </template>

          <div class="image-container" v-if="resultUrl" ref="imageContainer">
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
            <el-empty description="Generated image will appear here" />
          </div>
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
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

const imageContainer = ref<HTMLElement | null>(null)
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
      throw new Error('Upload failed')
    }
  } catch (err: any) {
    throw new Error('Image upload failed: ' + err.message)
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
        throw new Error('Failed to get uploaded image URL')
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
      throw new Error(`Generation API Error: ${response.status} ${response.statusText}`)
    }

    if (!response.body) throw new Error('ReadableStream not supported.')

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
               throw new Error(data.failure_reason || data.error || 'Generation failed')
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
      const x = xPoints[j]
      const y = yPoints[i]
      const w = xPoints[j+1] - x
      const h = yPoints[i+1] - y
      
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
    ElMessage.success('Download started!')
  } else {
    ElMessage.warning('No slices generated')
  }
}
</script>

<style scoped>
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

.result-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.result-card :deep(.el-card__body) {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f0f2f5;
  padding: 20px;
}

.image-container {
  position: relative;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  display: inline-block; /* Fit content */
  max-width: 100%;
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
  background-color: #ff4081;
  z-index: 10;
}

.h-line {
  left: 0;
  right: 0;
  height: 2px;
  cursor: ns-resize;
}

.v-line {
  top: 0;
  bottom: 0;
  width: 2px;
  cursor: ew-resize;
}

.line:hover {
  background-color: #f50057;
  box-shadow: 0 0 5px rgba(255, 64, 129, 0.8);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.generate-btn {
  width: 100%;
  margin-top: 20px;
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
