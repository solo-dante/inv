import { app, BrowserWindow, screen, ipcMain, globalShortcut } from "electron"
import path from "node:path"
import fs from "node:fs"
import { v4 as uuidv4 } from "uuid"
import screenshot from "screenshot-desktop"
import FormData from "form-data"
import axios from "axios"

class AppState {
  private static instance: AppState | null = null

  // Window management
  private mainWindow: BrowserWindow | null = null
  private isWindowVisible: boolean = true
  private windowPosition: { x: number; y: number } | null = null
  private windowSize: { width: number; height: number } | null = null

  // View and queue management
  private view: "queue" | "solutions" = "queue"
  private screenshotQueue: string[] = []
  private extraScreenshotQueue: string[] = []
  private readonly MAX_SCREENSHOTS = 5
  private problemInfo: {
    problem_statement: string
    input_format: Record<string, any>
    output_format: Record<string, any>
    constraints: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  }

  // Directory paths
  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  // Processing events
  private readonly PROCESSING_EVENTS = {
    START: "processing-start",
    SUCCESS: "processing-success",
    ERROR: "processing-error",
    NO_SCREENSHOTS: "processing-no-screenshots",
    EXTRA_SUCCESS: "extra-processing-success"
  } as const

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  private constructor() {
    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

    // Create directories if they don't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir)
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir)
    }

    this.initializeIpcHandlers()
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  // Getters
  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public isVisible(): boolean {
    return this.isWindowVisible
  }

  private getScreenHeight(): number {
    const primaryDisplay = screen.getPrimaryDisplay()
    return primaryDisplay.workAreaSize.height
  }

  // Window management methods
  public createWindow(): void {
    if (this.mainWindow !== null) return

    const screenHeight = this.getScreenHeight()
    const windowSettings = {
      width: 600,
      height: screenHeight,
      x: 0,
      y: 0,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      },
      show: true,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      fullscreenable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      focusable: true
    }

    this.mainWindow = new BrowserWindow(windowSettings)
    if (process.platform === "darwin") {
      this.mainWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      })
      this.mainWindow.setAlwaysOnTop(true, "floating")
    }

    const isDev = process.env.NODE_ENV === "development"
    const startUrl = isDev
      ? "http://localhost:5173"
      : `file://${path.join(__dirname, "../dist/index.html")}`

    this.mainWindow.loadURL(startUrl).catch((err) => {
      console.error("Failed to load URL:", err)
    })
    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }

    this.setupWindowListeners()
  }

  private setupWindowListeners(): void {
    if (!this.mainWindow) return

    this.mainWindow.on("move", () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds()
        this.windowPosition = { x: bounds.x, y: bounds.y }
      }
    })

    this.mainWindow.on("resize", () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds()
        this.windowSize = { width: bounds.width, height: bounds.height }
      }
    })

    this.mainWindow.on("closed", () => {
      this.mainWindow = null
      this.isWindowVisible = false
      this.windowPosition = null
      this.windowSize = null
    })
  }

  // Window visibility methods
  public hideMainWindow(): void {
    if (!this.mainWindow) {
      this.createWindow()
      return
    }

    if (this.mainWindow.isDestroyed()) {
      this.createWindow()
      return
    }

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    this.mainWindow.hide()
    this.isWindowVisible = false
  }

  public showMainWindow(): void {
    if (!this.mainWindow) {
      this.createWindow()
      return
    }

    if (this.mainWindow.isDestroyed()) {
      this.createWindow()
      return
    }

    const focusedWindow = BrowserWindow.getFocusedWindow()

    if (this.windowPosition && this.windowSize) {
      this.mainWindow.setBounds({
        x: this.windowPosition.x,
        y: this.windowPosition.y,
        width: this.windowSize.width,
        height: this.windowSize.height
      })
    }

    this.mainWindow.showInactive()

    if (focusedWindow && !focusedWindow.isDestroyed()) {
      focusedWindow.focus()
    }

    this.isWindowVisible = true
  }

  public toggleMainWindow(): void {
    if (this.isWindowVisible) {
      this.hideMainWindow()
    } else {
      this.showMainWindow()
    }
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err)
      })
    })
    this.screenshotQueue = []

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }

  // Screenshot management methods
  private async takeScreenshot(): Promise<string> {
    if (!this.mainWindow) throw new Error("No main window available")

    this.hideMainWindow()
    let screenshotPath = ""

    if (this.view === "queue") {
      screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`)
      await screenshot({ filename: screenshotPath })

      this.screenshotQueue.push(screenshotPath)
      if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
        const removedPath = this.screenshotQueue.shift()
        if (removedPath) {
          try {
            await fs.promises.unlink(removedPath)
          } catch (error) {
            console.error("Error removing old screenshot:", error)
          }
        }
      }
    } else {
      screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`)
      await screenshot({ filename: screenshotPath })

      this.extraScreenshotQueue.push(screenshotPath)
      if (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
        const removedPath = this.extraScreenshotQueue.shift()
        if (removedPath) {
          try {
            await fs.promises.unlink(removedPath)
          } catch (error) {
            console.error("Error removing old screenshot:", error)
          }
        }
      }
    }

    this.showMainWindow()
    return screenshotPath
  }

  private async getImagePreview(filepath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filepath)
      return `data:image/png;base64,${data.toString("base64")}`
    } catch (error) {
      console.error("Error reading image:", error)
      throw error
    }
  }

  // Processing methods
  private async processScreenshots(): Promise<void> {
    if (!this.mainWindow) return

    if (this.view === "queue") {
      if (this.screenshotQueue.length === 0) {
        this.mainWindow.webContents.send(this.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      this.mainWindow.webContents.send(this.PROCESSING_EVENTS.START)

      // Initialize AbortController
      this.currentProcessingAbortController = new AbortController()
      const { signal } = this.currentProcessingAbortController

      try {
        const screenshots = await Promise.all(
          this.screenshotQueue.map(async (path) => ({
            path,
            preview: await this.getImagePreview(path)
          }))
        )

        console.log("regular screenshots")
        screenshots.forEach((screenshot: any) => {
          console.log(screenshot.path)
        })

        const result = await this.processScreenshotsHelper(screenshots, signal)

        if (result.success) {
          console.log("Processing success:", result.data)
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.SUCCESS,
            result.data
          )
        } else {
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.ERROR,
            result.error
          )
        }
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log("Processing request canceled")
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.ERROR,
            "Processing was canceled by the user."
          )
        } else {
          console.error("Processing error:", error)
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.ERROR,
            error.message
          )
        }
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // Existing logic for 'solutions' view

      if (this.extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots to process")
        this.mainWindow.webContents.send(this.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      this.mainWindow.webContents.send(this.PROCESSING_EVENTS.START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        const screenshots = await Promise.all(
          [...this.screenshotQueue, ...this.extraScreenshotQueue].map(
            async (path) => ({
              path,
              preview: await this.getImagePreview(path)
            })
          )
        )

        const result = await this.processExtraScreenshotsHelper(
          screenshots,
          signal
        )

        if (result.success) {
          console.log("Processing extra screenshots success:", result.data)
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.EXTRA_SUCCESS,
            result.data
          )
        } else {
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.ERROR,
            result.error
          )
        }
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log("Extra processing request canceled")
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.ERROR,
            "Extra processing was canceled by the user."
          )
        } else {
          console.error("Processing error:", error)
          this.mainWindow.webContents.send(
            this.PROCESSING_EVENTS.ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string }>,
    signal: AbortSignal // Added signal parameter
  ) {
    try {
      const formData = new FormData()

      screenshots.forEach((screenshot) => {
        formData.append("images", fs.createReadStream(screenshot.path))
      })

      let response
      try {
        this.view = "solutions"
        response = await axios.post(
          "https://web-production-b2eb.up.railway.app/extract_problem",
          formData,
          {
            headers: {
              ...formData.getHeaders()
            },
            timeout: 300000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            signal // Attach the AbortSignal here
          }
        )
        this.problemInfo = {
          problem_statement: response.data.problem_statement,
          input_format: response.data.input_format,
          output_format: response.data.output_format,
          constraints: response.data.constraints,
          test_cases: response.data.test_cases
        }
      } catch (error: any) {
        this.view = "queue"
        // Removed error dispatching here
        throw error // Rethrow to handle in the outer try-catch
      }

      this.view = "solutions"

      return { success: true, data: response.data }
    } catch (error) {
      console.error("Processing error:", error)
      return { success: false, error: error.message }
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string }>,
    signal: AbortSignal // Added signal parameter
  ) {
    try {
      const formData = new FormData()

      // Add images first
      screenshots.forEach((screenshot) => {
        formData.append("images", fs.createReadStream(screenshot.path))
      })

      if (!this.problemInfo) {
        throw new Error("No problem info available")
      }

      // Add problem_info
      formData.append("problem_info", JSON.stringify(this.problemInfo))

      const response = await axios.post(
        "https://web-production-b2eb.up.railway.app/debug_solutions",
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 300000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          signal // Attach the AbortSignal here
        }
      )

      if (!response || !response.data) {
        throw new Error("No response data received")
      }

      return { success: true, data: response.data }
    } catch (error) {
      console.error("Processing error:", error)
      if (axios.isAxiosError(error)) {
        console.error("Response status:", error.response?.status)
        console.error("Response error data:", error.response?.data)
      }
      return { success: false, error: error.message }
    }
  }

  public async deleteScreenshot(path: string) {
    try {
      await fs.promises.unlink(path)
      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        )
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        )
      }
      return { success: true }
    } catch (error) {
      console.error("Error deleting file:", error)
      return { success: false, error: error.message }
    }
  }

  // IPC Handlers setup
  private initializeIpcHandlers(): void {
    ipcMain.handle("update-content-height", async (event, height: number) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const [width] = this.mainWindow.getSize()
        this.mainWindow.setSize(width, Math.ceil(height))
      }
    })

    ipcMain.handle("delete-screenshot", async (event, path: string) => {
      return this.deleteScreenshot(path)
    })

    ipcMain.handle("take-screenshot", async () => {
      try {
        const screenshotPath = await this.takeScreenshot()
        const preview = await this.getImagePreview(screenshotPath)
        return { path: screenshotPath, preview }
      } catch (error) {
        console.error("Error taking screenshot:", error)
        throw error
      }
    })

    ipcMain.handle("get-screenshots", async () => {
      console.log({
        view: this.view
      })
      try {
        let previews = []
        if (this.view === "queue") {
          previews = await Promise.all(
            this.screenshotQueue.map(async (path) => ({
              path,
              preview: await this.getImagePreview(path)
            }))
          )
        } else {
          previews = await Promise.all(
            this.extraScreenshotQueue.map(async (path) => ({
              path,
              preview: await this.getImagePreview(path)
            }))
          )
        }
        previews.forEach((preview: any) => console.log(preview.path))
        return previews
      } catch (error) {
        console.error("Error getting screenshots:", error)
        throw error
      }
    })

    ipcMain.handle("toggle-window", async () => {
      this.toggleMainWindow()
    })

    ipcMain.handle("reset-queues", async () => {
      try {
        this.clearQueues()
        console.log("Screenshot queues have been cleared.")
        return { success: true }
      } catch (error: any) {
        console.error("Error resetting queues:", error)
        return { success: false, error: error.message }
      }
    })
  }

  // Method to cancel ongoing API requests
  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      console.log("Canceled ongoing processing request.")
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      console.log("Canceled ongoing extra processing request.")
      wasCancelled = true
    }

    if (wasCancelled && this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(
        this.PROCESSING_EVENTS.ERROR,
        "Processing was canceled by the user."
      )
    }
  }

  // Global shortcuts setup
  public setupGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+H", async () => {
      if (this.mainWindow) {
        console.log("Taking screenshot...")
        try {
          const screenshotPath = await this.takeScreenshot()
          const preview = await this.getImagePreview(screenshotPath)
          this.mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        } catch (error) {
          console.error("Error capturing screenshot:", error)
        }
      }
    })

    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.processScreenshots()
    })

    globalShortcut.register("CommandOrControl+R", () => {
      console.log(
        "Command + R pressed. Canceling requests and resetting queues..."
      )

      // Cancel ongoing API requests
      this.cancelOngoingRequests()

      // Clear both screenshot queues
      this.clearQueues()

      console.log("Cleared queues.")

      // Update the view state to 'queue'
      this.view = "queue"

      // Notify renderer process to switch view to 'queue'
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("reset-view")
      }
    })

    globalShortcut.register("CommandOrControl+B", () => {
      this.toggleMainWindow()
      // If window exists and we're showing it, bring it to front
      if (this.mainWindow && !this.isWindowVisible) {
        // Force the window to the front on macOS
        if (process.platform === "darwin") {
          this.mainWindow.setAlwaysOnTop(true, "normal")
          // Reset alwaysOnTop after a brief delay
          setTimeout(() => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.setAlwaysOnTop(true, "floating")
            }
          }, 100)
        }
      }
    })
  }
}

// Application initialization
async function initializeApp() {
  const appState = AppState.getInstance()

  app.whenReady().then(() => {
    appState.createWindow()
    appState.setupGlobalShortcuts()

    app.on("activate", () => {
      if (!appState.getMainWindow()) {
        appState.createWindow()
      } else if (!appState.isVisible()) {
        appState.toggleMainWindow()
      }
    })
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  // Unregister shortcuts when quitting
  app.on("will-quit", () => {
    globalShortcut.unregisterAll()
  })

  app.dock?.hide() // Hide dock icon (optional)
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

// Start the application
initializeApp().catch(console.error)
