import { ipcMain } from "electron"
import type { SolutionsResponse } from "../types/solutions"
import screenshot from "screenshot-desktop"
import axios from "axios"
import FormData from "form-data"
import fs from "fs"
import path from "path"
import { app } from "electron"

export const setupIPC = () => {
  ipcMain.handle("take-screenshot", async () => {
    try {
      const tempPath = path.join(app.getPath("temp"), "screenshot.png")
      await screenshot({ filename: tempPath })

      const formData = new FormData()
      formData.append("image", fs.createReadStream(tempPath))
      formData.append(
        "text_prompt",
        "Analyze the coding problem in the image and provide three possible solutions with different approaches and trade-offs. For each solution, include: \n" +
          "1. Initial thoughts: 2-3 first impressions and key observations about the problem\n" +
          "2. Thought steps: A natural progression of how you would think through implementing this solution, as if explaining to an interviewer\n" +
          "3. Detailed explanation of the approach and its trade-offs\n" +
          "4. Complete, well-commented code implementation\n" +
          "Structure the solutions from simplest/most intuitive to most optimized. Focus on clear explanation and clean code."
      )

      const response = await axios.post<{ solutions: SolutionsResponse }>(
        "https://web-production-b2eb.up.railway.app/process_image",
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 30000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      )

      // Clean up temp file
      fs.unlink(tempPath, (err) => {
        if (err) console.error("Error deleting temporary screenshot:", err)
      })

      return response.data.solutions
    } catch (error) {
      console.error("Error processing screenshot:", error)
      throw error
    }
  })
}
