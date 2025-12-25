<template>
  <div class="meme-generator">
    <el-container direction="vertical" class="app-container">
      <el-header class="neu-header">
        <div class="logo">
          <span class="logo-icon">🎨</span>
          <span class="logo-text">表情包创作平台</span>
        </div>
        <div class="auth-buttons" v-if="!user">
          <el-button class="neu-button small" @click="isLoginVisible = true">登录</el-button>
          <el-button class="neu-button primary small" @click="isRegisterVisible = true">注册</el-button>
        </div>
        <div class="auth-buttons" v-else>
          <span class="welcome-text">欢迎, {{ user.username }} (积分: {{ user.points }})</span>
          <el-button class="neu-button success small" @click="handleBuyPoints">购买积分</el-button>
          <el-button v-if="user.role === 'admin'" class="neu-button secondary small" @click="openAdminPanel">管理后台</el-button>
          <el-button class="neu-button danger small" @click="logout">退出</el-button>
        </div>
      </el-header>
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

            <el-form-item label="风格">
              <el-radio-group v-model="bodyStyle">
                <el-radio label="半身像">半身像</el-radio>
                <el-radio label="全身像">全身像</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="参考角色图">
              <el-upload
                class="upload-demo"
                action="#"
                :auto-upload="false"
                :on-change="handleFileChange"
                :show-file-list="false"
              >
                <el-button class="neu-button secondary">选择图片</el-button>
                <template #tip>
                  <div class="el-upload__tip">
                    jpg/png 文件，大小不超过 500kb
                  </div>
                </template>
              </el-upload>
              <div v-if="fileList.length > 0" class="file-preview">
                 <div class="file-name">{{ fileList[0].name }}</div>
                 <img v-if="uploadedUrl" :src="uploadedUrl" class="uploaded-thumb" />
              </div>
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

        <!-- History Section -->
        <el-card class="neu-card history-card" style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span class="header-title">历史记录</span>
            </div>
          </template>
          <div class="history-list">
            <el-empty v-if="historyList.length === 0" description="暂无历史记录" />
            <div 
              v-for="item in historyList" 
              :key="item.id" 
              class="history-item"
              @click="loadFromHistory(item)"
            >
              <div class="history-info">
                <span class="history-subject">{{ item.subject }}</span>
                <span class="history-date">{{ new Date(item.createdAt).toLocaleString() }}</span>
              </div>
              <el-button 
                class="neu-button danger small" 
                size="small" 
                @click.stop="deleteHistory(item.id!)"
              >
                删除
              </el-button>
            </div>
          </div>
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
                <el-button class="neu-button warning small" size="small" @click="autoSlice">自动分割</el-button>
                <el-button class="neu-button danger small" size="small" @click="resetLines">重置分隔线</el-button>
                <el-button class="neu-button success small" size="small" @click="sliceAndDownload">切割并下载</el-button>
              </div>
            </div>
          </template>

          <div class="image-container-wrapper">
            <div class="image-container" v-if="resultUrl">
              <img :src="resultUrl" ref="resultImage" class="result-image" @load="initSlicing" crossorigin="anonymous"/>
              
              <div
                v-for="(rect, idx) in regions"
                :key="'r-' + idx"
                class="region-overlay"
                :style="{ top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px', height: rect.height + 'px' }"
                @click="handleRegionClick(rect)"
              ></div>

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
    </el-container>

    <!-- Login Dialog -->
    <el-dialog v-model="isLoginVisible" title="登录" width="30%" class="neu-dialog">
      <el-form :model="loginForm" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="loginForm.username" class="neu-input" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" class="neu-input" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button class="neu-button" @click="isLoginVisible = false">取消</el-button>
          <el-button class="neu-button primary" @click="handleLogin">登录</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Register Dialog -->
    <el-dialog v-model="isRegisterVisible" title="注册" width="30%" class="neu-dialog">
      <el-form :model="registerForm" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="registerForm.username" class="neu-input" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="registerForm.password" type="password" class="neu-input" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button class="neu-button" @click="isRegisterVisible = false">取消</el-button>
          <el-button class="neu-button primary" @click="handleRegister">注册</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Admin Dialog -->
    <el-dialog v-model="isAdminVisible" title="用户管理" width="60%" class="neu-dialog">
      <el-table :data="adminUserList" style="width: 100%" border class="neu-table">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="role" label="角色" width="100" />
        <el-table-column prop="points" label="积分" width="120">
          <template #default="scope">
            <el-input-number v-model="scope.row.points" :min="0" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button size="small" class="neu-button primary small" @click="saveUserPoints(scope.row)">保存</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
    <!-- Preview Dialog -->
    <el-dialog v-model="previewVisible" title="预览" width="50%" class="neu-dialog preview-dialog">
      <div class="preview-container">
        <img :src="previewUrl" class="preview-image" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button class="neu-button" @click="previewVisible = false">关闭</el-button>
          <el-button class="neu-button success" @click="copyPreview">复制</el-button>
          <el-button class="neu-button primary" @click="downloadPreview">下载</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { ElMessage } from 'element-plus'
import { saveMemeToHistory, getMemeHistory, deleteMemeFromHistory } from '../utils/db'

// Auth State
const user = ref<any>(null)
const isLoginVisible = ref(false)
const isRegisterVisible = ref(false)
const loginForm = reactive({
  username: '',
  password: ''
})
const registerForm = reactive({
  username: '',
  password: ''
})

const isAdminVisible = ref(false)
const adminUserList = ref<any[]>([])

const API_BASE_URL = '/api'

const refreshUser = async () => {
  const token = localStorage.getItem('token')
  if (!token) return
  
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const userData = await response.json()
      user.value = userData
      localStorage.setItem('user', JSON.stringify(userData))
    }
  } catch (e) {
    console.error('Failed to refresh user', e)
  }
}

const openAdminPanel = async () => {
  const token = localStorage.getItem('token')
  try {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      adminUserList.value = await response.json()
      isAdminVisible.value = true
    } else {
      ElMessage.error('无法获取用户列表')
    }
  } catch (e) {
    ElMessage.error('连接服务器失败')
  }
}

const saveUserPoints = async (userData: any) => {
  const token = localStorage.getItem('token')
  try {
    const response = await fetch(`${API_BASE_URL}/admin/update-points`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId: userData.id, points: userData.points })
    })
    if (response.ok) {
      ElMessage.success('积分更新成功')
      if (userData.id === user.value.id) {
        refreshUser()
      }
    } else {
      ElMessage.error('更新失败')
    }
  } catch (e) {
    ElMessage.error('连接服务器失败')
  }
}

const handleBuyPoints = async () => {
  const token = localStorage.getItem('token')
  try {
    const response = await fetch(`${API_BASE_URL}/create-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        ElMessage.error('无法获取支付链接')
      }
    } else {
      ElMessage.error('请求支付失败')
    }
  } catch (e) {
    ElMessage.error('连接服务器失败')
  }
}

const handleLogin = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    })
    const data = await response.json()
    if (response.ok) {
      user.value = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      isLoginVisible.value = false
      ElMessage.success('登录成功')
    } else {
      ElMessage.error(data.error || '登录失败')
    }
  } catch (e) {
    ElMessage.error('连接服务器失败')
  }
}

const handleRegister = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerForm)
    })
    const data = await response.json()
    if (response.ok) {
      ElMessage.success('注册成功，请登录')
      isRegisterVisible.value = false
      isLoginVisible.value = true
    } else {
      ElMessage.error(data.error || '注册失败')
    }
  } catch (e) {
    ElMessage.error('连接服务器失败')
  }
}

const logout = () => {
  user.value = null
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  ElMessage.success('已退出登录')
}

const updateImageDimensions = () => {
  if (resultImage.value) {
    imgWidth.value = resultImage.value.clientWidth
    imgHeight.value = resultImage.value.clientHeight
  }
}

// Check local storage on mount
onMounted(() => {
  const storedUser = localStorage.getItem('user')
  if (storedUser) {
    user.value = JSON.parse(storedUser)
    refreshUser() // Fetch latest points
  }
  refreshHistory()
  checkPaymentResult()
  window.addEventListener('resize', updateImageDimensions)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateImageDimensions)
})

const checkPaymentResult = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const out_trade_no = urlParams.get('out_trade_no')
  const trade_status = urlParams.get('trade_status')

  if (out_trade_no && trade_status === 'TRADE_SUCCESS') {
    try {
      // Manually trigger notification for local testing environment
      // In production, this should rely on server-to-server callback
      const response = await fetch(`${API_BASE_URL}/payment-notify?out_trade_no=${out_trade_no}&trade_status=${trade_status}`)
      const result = await response.text()
      
      if (result === 'success') {
        ElMessage.success('支付成功，积分已到账！')
        refreshUser()
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
      } else {
        // It might have been processed by server callback already
        refreshUser()
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } catch (e) {
      console.error('Check payment failed', e)
    }
  }
}

const subject = ref('')
const bodyStyle = ref('半身像')
const fileList = ref<any[]>([])
const uploadedFile = ref<File | null>(null)
const uploadedUrl = ref('')
const resultUrl = ref('')
const loading = ref(false)
const error = ref('')

const resultImage = ref<HTMLImageElement | null>(null)
const imgWidth = ref(0)
const imgHeight = ref(0)

// History State
const historyList = ref<any[]>([])

const refreshHistory = async () => {
  historyList.value = (await getMemeHistory()).reverse()
}

const loadFromHistory = (item: any) => {
  if (resultUrl.value && resultUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(resultUrl.value)
  }
  resultUrl.value = URL.createObjectURL(item.blob)
  subject.value = item.subject
  // Reset lines
  hLines.value = []
  vLines.value = []
  
  // Wait for image to load before auto slicing or enabling controls
  // The @load="initSlicing" on the img tag will handle any post-load logic
}

const deleteHistory = async (id: number) => {
  await deleteMemeFromHistory(id)
  await refreshHistory()
  ElMessage.success('已删除历史记录')
}

// Slicing State
const hLines = ref<number[]>([])
const vLines = ref<number[]>([])
const dragging = reactive({
  active: false,
  type: '' as 'h' | 'v',
  index: -1
})

const handleRegionClick = async (rect: any) => {
  if (!resultImage.value) return

  const img = resultImage.value
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight
  const displayWidth = img.clientWidth
  const displayHeight = img.clientHeight
  
  const scaleX = naturalWidth / displayWidth
  const scaleY = naturalHeight / displayHeight

  const x = rect.left * scaleX
  const y = rect.top * scaleY
  const w = rect.width * scaleX
  const h = rect.height * scaleY

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const sourceImage = new Image()
  sourceImage.crossOrigin = "Anonymous"
  sourceImage.src = resultUrl.value
  
  await new Promise((resolve, reject) => {
    sourceImage.onload = resolve
    sourceImage.onerror = reject
  })

  ctx.drawImage(sourceImage, x, y, w, h, 0, 0, w, h)
  
  canvas.toBlob((blob) => {
    if (blob) {
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = URL.createObjectURL(blob)
      previewVisible.value = true
    }
  }, 'image/png')
}

const downloadPreview = () => {
  if (previewUrl.value) {
    saveAs(previewUrl.value, `slice_${Date.now()}.png`)
  }
}

const copyPreview = async () => {
  if (!previewUrl.value) return
  
  // Check if Clipboard API is available
  if (!navigator.clipboard || !navigator.clipboard.write) {
    ElMessage.warning('您的浏览器不支持自动复制图片，请右键图片选择“复制图片”')
    return
  }
  
  try {
    const response = await fetch(previewUrl.value)
    const blob = await response.blob()
    
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ])
    
    ElMessage.success('图片已复制到剪贴板')
  } catch (err) {
    console.error(err)
    ElMessage.error('复制失败，请重试')
  }
}

const previewVisible = ref(false)
const previewUrl = ref('')

const regions = computed(() => {
  if (!imgWidth.value || !imgHeight.value) return []

  const sortedHLines = [...hLines.value].sort((a, b) => a - b)
  const sortedVLines = [...vLines.value].sort((a, b) => a - b)

  const ys = [0, ...sortedHLines, imgHeight.value]
  const xs = [0, ...sortedVLines, imgWidth.value]

  const rects = []
  for (let i = 0; i < ys.length - 1; i++) {
    for (let j = 0; j < xs.length - 1; j++) {
      rects.push({
        top: ys[i],
        left: xs[j],
        width: xs[j+1]! - xs[j]!,
        height: ys[i+1]! - ys[i]!
      })
    }
  }
  return rects
})

const handleFileChange = (file: any) => {
  uploadedFile.value = file.raw
  fileList.value = [file]
  // Reset previous state
  if (uploadedUrl.value) {
    URL.revokeObjectURL(uploadedUrl.value)
  }
  uploadedUrl.value = URL.createObjectURL(file.raw)
  resultUrl.value = ''
  error.value = ''
}

const handleGenerate = async () => {
  loading.value = true
  error.value = ''
  hLines.value = []
  vLines.value = []
  
  try {
    if (!user.value) {
      isLoginVisible.value = true
      throw new Error('请先登录')
    }

    // 0. Deduct Points
    const token = localStorage.getItem('token')
    const deductRes = await fetch(`${API_BASE_URL}/deduct-points`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!deductRes.ok) {
      const errData = await deductRes.json()
      throw new Error(errData.error || '积分扣除失败')
    }
    
    // Update local points
    const deductData = await deductRes.json()
    user.value.points = deductData.points
    localStorage.setItem('user', JSON.stringify(user.value))

    if (!uploadedFile.value) {
      throw new Error('请选择参考图片')
    }

    // 1. Convert File to Base64
    const base64Image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        if (base64) {
          resolve(base64)
        } else {
          reject(new Error('Failed to parse base64'))
        }
      }
      reader.onerror = reject
      if (uploadedFile.value) {
        reader.readAsDataURL(uploadedFile.value)
      } else {
        reject(new Error('No file selected'))
      }
    })

    // 2. Prepare Payload
    const prompt = `为我生成图中角色的绘制 Q 版的，LINE 风格的${bodyStyle.value}表情包，注意头饰要正确，彩色手绘风格，使用 4x6 布局，涵盖各种各样的关于【${subject.value}】的语句，或是一些有关【${subject.value}】的 meme，其他需求：不要原图复制。所有标注为手写简体中文。全身像要显示整个身子而且头大身小。`
    
    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: uploadedFile.value.type || 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
        }
      }
    }

    // 3. Call API
    const response = await fetch('https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-dwI0wRUeibzNWZYMDeA400D567354d85BdF3A8BfCeBc0aD3'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`生成API错误: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    // 4. Parse Result
    if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
      const inlineData = result.candidates[0].content.parts[0].inlineData
      if (inlineData && inlineData.data) {
        // Convert Base64 response to Blob/URL
        const byteCharacters = atob(inlineData.data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: inlineData.mime_type || 'image/png' }) // Default to png if mime_type missing
        resultUrl.value = URL.createObjectURL(blob)
      } else {
         throw new Error('API返回结果中未找到图片数据')
      }
    } else {
      throw new Error('API返回格式不符合预期')
    }

    // Save to History
    if (resultUrl.value) {
      try {
        const imageRes = await fetch(resultUrl.value)
        const blob = await imageRes.blob()
        await saveMemeToHistory(blob, subject.value)
        await refreshHistory()
      } catch (e) {
        console.error('Failed to save history:', e)
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
  if (resultImage.value) {
    imgWidth.value = resultImage.value.clientWidth
    imgHeight.value = resultImage.value.clientHeight
  }
}

const addHLine = () => {
  if (!resultImage.value) return
  hLines.value.push(resultImage.value.clientHeight / 2)
}

const addVLine = () => {
  if (!resultImage.value) return
  vLines.value.push(resultImage.value.clientWidth / 2)
}

const resetLines = () => {
  hLines.value = []
  vLines.value = []
}

const autoSlice = () => {
  if (!resultImage.value) return
  
  // Reset lines first
  hLines.value = []
  vLines.value = []
  
  const height = resultImage.value.clientHeight
  const width = resultImage.value.clientWidth
  
  // 4 rows -> 3 lines
  const rowHeight = height / 4
  for (let i = 1; i < 4; i++) {
    hLines.value.push(rowHeight * i)
  }
  
  // 6 columns -> 5 lines
  const colWidth = width / 6
  for (let i = 1; i < 6; i++) {
    vLines.value.push(colWidth * i)
  }
  
  ElMessage.success('已自动按 4x6 布局分割，您可以手动微调')
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

.app-container {
  height: 100vh;
}

.neu-header {
  height: 60px !important; /* Force height */
  border-bottom: 3px solid #000 !important;
  background-color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px !important;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.5rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.auth-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}

.welcome-text {
  font-weight: bold;
  margin-right: 10px;
}

/* Neu-Brutalism Dialog */
:deep(.neu-dialog) {
  border: 3px solid #000 !important;
  border-radius: 0 !important;
  box-shadow: 6px 6px 0px 0px #000 !important;
}

:deep(.neu-dialog .el-dialog__header) {
  border-bottom: 3px solid #000 !important;
  background-color: #FFEB3B;
  margin-right: 0 !important;
  padding: 15px 20px;
}

:deep(.neu-dialog .el-dialog__title) {
  font-weight: 900;
  text-transform: uppercase;
  color: #000;
}

:deep(.neu-dialog .el-dialog__body) {
  padding: 20px;
}

:deep(.neu-dialog .el-dialog__footer) {
  padding: 15px 20px;
  border-top: 3px solid #000;
  background-color: #f0f0f0;
}

.main-container {
  flex: 1;
  padding: 20px;
  overflow: hidden;
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

.neu-button.danger {
  background-color: #F44336 !important;
  color: #fff !important;
}

.neu-button.danger:hover {
  background-color: #EF5350 !important;
}

.neu-button.warning {
  background-color: #FF9800 !important; /* Orange */
  color: #000 !important;
}

.neu-button.warning:hover {
  background-color: #FFB74D !important;
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
  flex-wrap: wrap;
  gap: 10px;
}

.controls {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
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

.history-card {
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.history-card :deep(.el-card__body) {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 2px solid #000;
  cursor: pointer;
  background-color: #fff;
  transition: all 0.2s;
}

.history-item:hover {
  background-color: #f0f0f0;
  transform: translate(-2px, -2px);
  box-shadow: 2px 2px 0px 0px #000;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-subject {
  font-weight: bold;
  font-size: 14px;
}

.history-date {
  font-size: 12px;
  color: #666;
}

.placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}

@media (max-width: 768px) {
  .meme-generator {
    height: auto !important;
    min-height: 100vh;
    overflow-y: visible !important;
  }

  .app-container {
    height: auto !important;
    overflow: visible !important;
  }

  .main-container {
    flex-direction: column !important;
    height: auto !important;
    overflow: visible !important;
    display: block !important;
  }

  .left-panel {
    width: 100% !important;
    padding-right: 0 !important;
    margin-bottom: 20px;
  }

  .right-panel {
    height: auto !important;
    min-height: 500px;
    overflow: visible !important;
    padding-bottom: 20px !important;
  }

  .result-card {
    height: auto !important;
    min-height: 500px;
  }

  .result-card :deep(.el-card__body) {
    height: auto !important;
    min-height: 400px;
    overflow: visible !important;
  }

  .image-container-wrapper {
    height: auto !important;
    min-height: 400px;
  }

  .neu-header {
    padding: 0 10px !important;
  }

  .logo-text {
    font-size: 1rem;
    display: none; /* Hide text on small screens to save space */
  }

  .welcome-text {
    /* display: none;  Remove this as we want to show points */
    font-size: 12px;
  }
  
  .user-name {
    display: none;
  }
  
  .user-points {
    display: inline-block;
    margin-right: 5px;
  }

  .auth-buttons .neu-button {
    padding: 4px 8px !important;
    font-size: 12px !important;
  }

  /* Adjust dialog width for mobile */
  :deep(.neu-dialog) {
    width: 90% !important;
    margin-top: 20vh !important;
  }
}

.region-overlay {
  position: absolute;
  z-index: 5;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0);
  transition: background-color 0.2s;
}

.region-overlay:hover {
  background-color: rgba(255, 235, 59, 0.3); /* Yellow highlight */
  border: 2px dashed #000;
}

.preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background-color: #f0f0f0;
  border: 3px solid #000;
}

.preview-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border: 2px solid #000;
}

.file-preview {
  margin-top: 10px;
  border: 2px solid #000;
  padding: 10px;
  background-color: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
}

.uploaded-thumb {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border: 1px solid #000;
}

.file-name {
  font-size: 12px;
  font-weight: bold;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
