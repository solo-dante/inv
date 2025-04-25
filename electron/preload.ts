import { contextBridge, ipcRenderer } from "electron"

// Types for the exposed Electron API
interface ElectronAPI {
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>
  updateContentHeight: (
    height: number
  ) => Promise<{ success: boolean; error?: string }>
  takeScreenshot: () => Promise<{
    success: boolean
    path?: string
    preview?: string
    error?: string
  }>
  getScreenshots: () => Promise<{
    success: boolean
    previews?: Array<{ path: string; preview: string }> | null
    error?: string
  }>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onProcessingStart: (callback: () => void) => () => void
  onProcessingSuccess: (callback: (data: any) => void) => () => void
  onProcessingExtraSuccess: (callback: (data: any) => void) => () => void
  onProcessingError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
}

const PROCESSING_EVENTS = {
  START: "processing-start",
  SUCCESS: "processing-success",
  EXTRA_SUCCESS: "extra-processing-success",
  ERROR: "processing-error",
  NO_SCREENSHOTS: "processing-no-screenshots"
} as const

// Expose the Electron API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  toggleMainWindow: () => ipcRenderer.invoke("toggle-window"),
  updateContentHeight: (height: number) =>
    ipcRenderer.invoke("update-content-height", height),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),

  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onSolutionsReady: (callback: (solutions: string) => void) => {
    const subscription = (_: any, solutions: string) => callback(solutions)
    ipcRenderer.on("solutions-ready", subscription)
    return () => {
      ipcRenderer.removeListener("solutions-ready", subscription)
    }
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onProcessingStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.START, subscription)
    }
  },
  onProcessingSuccess: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.SUCCESS, subscription)
    }
  },
  onProcessingExtraSuccess: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.EXTRA_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.EXTRA_SUCCESS, subscription)
    }
  },
  onProcessingError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.ERROR, subscription)
    }
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  }
} as ElectronAPI)
