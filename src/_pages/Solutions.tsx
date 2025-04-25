import { useQuery, useQueryClient } from "react-query"
import { useEffect, useState } from "react"
import { CodeBlock, dracula } from "react-code-blocks"
import SolutionsHelper from "../components/Solutions/SolutionsHelper"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import {
  Toast,
  ToastDescription,
  ToastMessage,
  ToastTitle,
  ToastVariant
} from "../components/ui/toast"
import { ProblemStatementData } from "../types/solutions";

interface problemStatementData extends ProblemStatementData {}

// Create an array of widths that look natural for text
const naturalWidths = [
  "w-[230px]", // Shorter sentence
  "w-[340px]", // Medium sentence
  "w-[0px]" // Long sentence
]

const SkeletonLine = ({ width = naturalWidths[2] }: { width?: string }) => (
  <div
    className={`h-3 bg-gray-300/50 rounded-sm animate-pulse ${width}`}
    style={{ maxWidth: "500px" }}
  />
)

const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <SkeletonLine width={naturalWidths[2]} /> {/* Long line */}
        <SkeletonLine width={naturalWidths[1]} /> {/* Medium line */}
        <SkeletonLine width={naturalWidths[0]} /> {/* Shorter line */}
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {content}
      </div>
    )}
  </div>
)

const SolutionSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <SkeletonLine width={naturalWidths[2]} />
        <SkeletonLine width={naturalWidths[1]} />
        <SkeletonLine width={naturalWidths[1]} />
        <SkeletonLine width={naturalWidths[0]} />
      </div>
    ) : (
      <div className="">
        <CodeBlock
          text={content as string}
          language="python"
          theme={dracula}
          customStyle={{
            maxWidth: "550px",
            overflow: "auto",
            whiteSpace: "pre-wrap"
          }}
        />
      </div>
    )}
  </div>
)

const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      Complexity
    </h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-gray-700/50 animate-pulse shrink-0" />
          <SkeletonLine width={naturalWidths[1]} />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-gray-700/50 animate-pulse shrink-0" />
          <SkeletonLine width={naturalWidths[1]} />
        </div>
      </div>
    ): (
      <div className="space-y-1">
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Time:</strong> {timeComplexity}
          </div>
        </div>
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Space:</strong> {spaceComplexity}
          </div>
        </div>
      </div>
    )}
  </div>
)

const Solutions: React.FC = () => {
  const queryClient = useQueryClient()
  const [problemStatementData, setProblemStatementData] =
    useState<problemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(null)
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(null)

  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  })

  const { data: extraScreenshots = [], refetch } = useQuery({
    queryKey: ["extras"],
    queryFn: async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        return existing
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        return []
      }
    }
  })

  const showToast = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    setToastMessage({ title, description, variant })
    setToastOpen(true)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch() // Refetch screenshots instead of managing state directly
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
    }
  }

  useEffect(() => {
    // Height update logic
    const updateHeight = () => {
      const contentHeight = document.body.scrollHeight
      window.electronAPI.updateContentHeight(contentHeight)
    }

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(document.body)
    updateHeight()

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onProcessingStart(() => {
        // Every time processing starts, reset relevant states
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
      }),

      window.electronAPI.onProcessingError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your extra screenshots.",
          "error"
        )
        // Reset solutions and complexities to previous states
        setSolutionData(queryClient.getQueryData(["solution"]) || null)
        setThoughtsData(queryClient.getQueryData(["thoughts"]) || null)
        setTimeComplexityData(queryClient.getQueryData(["time_complexity"]) || null)
        setSpaceComplexityData(queryClient.getQueryData(["space_complexity"]) || null)
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        )
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, []) // No dependency on Toggle View

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    )
    setSolutionData(queryClient.getQueryData(["solution"]) || null)
    setThoughtsData(queryClient.getQueryData(["thoughts"]) || null)
    setTimeComplexityData(queryClient.getQueryData(["time_complexity"]) || null)
    setSpaceComplexityData(queryClient.getQueryData(["space_complexity"]) || null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        )
      }
      if (event?.query.queryKey[0] === "thoughts") {
        setThoughtsData(queryClient.getQueryData(["thoughts"]) || null)
      }
      if (event?.query.queryKey[0] === "solution") {
        setSolutionData(queryClient.getQueryData(["solution"]) || null)
      }
      if (event?.query.queryKey[0] === "time_complexity") {
        setTimeComplexityData(queryClient.getQueryData(["time_complexity"]) || null)
      }
      if (event?.query.queryKey[0] === "space_complexity") {
        setSpaceComplexityData(queryClient.getQueryData(["space_complexity"]) || null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  return (
    <div className="relative space-y-3">
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        variant={toastMessage.variant}
        duration={3000}
      >
        <ToastTitle>{toastMessage.title}</ToastTitle>
        <ToastDescription>{toastMessage.description}</ToastDescription>
      </Toast>
      <div className="bg-transparent w-fit">
        <div className="pb-3">
          <div className="space-y-3 w-fit">
            <ScreenshotQueue
              screenshots={extraScreenshots}
              onDeleteScreenshot={handleDeleteExtraScreenshot}
            />
            <div className="pt-2 w-fit">
              <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-center gap-4">
                {/* Show/Hide */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] leading-none">Show/Hide</span>
                  <div className="flex gap-1">
                    <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      ⌘
                    </button>
                    <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      B
                    </button>
                  </div>
                </div>
                {extraScreenshots.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] leading-none">
                      Re-solve/Debug
                    </span>
                    <div className="flex gap-1">
                      <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                        ⌘
                      </button>
                      <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                        ↵
                      </button>
                    </div>
                  </div>
                )}
                {/* Screenshot */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] leading-none">
                    {extraScreenshots.length === 0
                      ? "Extra screenshot"
                      : "Screenshot"}
                  </span>
                  <div className="flex gap-1">
                    <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      ⌘
                    </button>
                    <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      H
                    </button>
                  </div>
                </div>

                {/* Start Over */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] leading-none">Start over</span>
                  <div className="flex gap-1">
                    <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      ⌘
                    </button>
                    <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      R
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full text-sm text-black backdrop-blur-md bg-black/60 rounded-md">
        <div className="rounded-lg overflow-hidden">
          <div className="px-4 py-3 space-y-4">
            <ContentSection
              title="Problem Statement"
              content={problemStatementData?.problem_statement}
              isLoading={!problemStatementData}
            />
            <ContentSection
              title="Thoughts"
              content={
                thoughtsData && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      {thoughtsData.map((thought, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                          <div>{thought}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              isLoading={!thoughtsData}
            />
            <SolutionSection
              title="Solutions"
              content={solutionData}
              isLoading={!solutionData}
            />
            <ComplexitySection
              timeComplexity={timeComplexityData}
              spaceComplexity={spaceComplexityData}
              isLoading={!timeComplexityData || !spaceComplexityData}
            />
          </div>
        </div>
      </div>
      <SolutionsHelper />
    </div>
  )
}

export default Solutions
