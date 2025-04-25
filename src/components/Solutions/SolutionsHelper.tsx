const SolutionsHelper = () => {
  return (
    <div className="relative">
      <div className="fixed bottom-8 right-8 group">
        {/* Question mark circle */}
        <div className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors flex items-center justify-center cursor-help z-10 relative">
          <span className="text-xs text-white/70">?</span>
        </div>

        {/* Invisible bridge that covers entire gap */}
        <div className="absolute bottom-[-2px] right-0 w-80 h-[calc(100%+8px)] group-hover:block hidden" />

        {/* Tooltip Content */}
        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block hover:block w-80">
          <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg">
            <div className="space-y-4">
              <h3 className="font-medium">Keyboard Shortcuts</h3>
              <div className="space-y-3">
                {/* Toggle Command */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Toggle Window</span>
                    <div className="flex gap-1">
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        ⌘
                      </span>
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        B
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/70">
                    Show or hide this window.
                  </p>
                </div>
                {/* Screenshot Command */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Take Screenshot</span>
                    <div className="flex gap-1">
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        ⌘
                      </span>
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        H
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/70">
                    <p className="text-[10px] leading-relaxed text-white/70">
                      Screenshot more parts of the question to add context, or
                      capture your solution to get debugging help. Up to 5
                      additional screenshots are saved.
                    </p>
                  </p>
                </div>

                {/* Solve Command */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Solve Problem</span>
                    <div className="flex gap-1">
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        ⌘
                      </span>
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        ↵
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/70">
                    Generate new solutions based on all previous and newly added
                    screenshots.
                  </p>
                </div>

                {/* Start Over Command */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Start Over</span>
                    <div className="flex gap-1">
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        ⌘
                      </span>
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                        R
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/70">
                    Start fresh with a new question.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SolutionsHelper
