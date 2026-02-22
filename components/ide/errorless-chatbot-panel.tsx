"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Trash2, Copy, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorlessChatbot, type ChatMessage } from "@/lib/errorless-chatbot"
import ReactMarkdown from "react-markdown"

interface ErrorlessChatbotPanelProps {
  selectedCode?: string
  selectedLanguage?: string
}

export function ErrorlessChatbotPanel({ selectedCode = "", selectedLanguage = "python" }: ErrorlessChatbotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm Errorless, your AI coding assistant. I can help you with:\n\n- **Code Generation** - Write code in any language\n- **Debugging** - Fix errors and bugs\n- **Explanations** - Learn programming concepts\n- **Optimization** - Improve code performance\n- **Best Practices** - Follow industry standards\n- **Comparisons** - Compare languages and tools\n\nWhat would you like help with?",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatbot] = useState(() => new ErrorlessChatbot())
  const [showNLPAnalysis, setShowNLPAnalysis] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await chatbot.processMessage(inputValue)
      setMessages((prev) => [...prev, response])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAction = (action: string) => {
    let prompt = ""
    switch (action) {
      case "debug":
        prompt = `Debug this ${selectedLanguage} code:\n\`\`\`${selectedLanguage}\n${selectedCode}\n\`\`\``
        break
      case "explain":
        prompt = `Explain this ${selectedLanguage} code:\n\`\`\`${selectedLanguage}\n${selectedCode}\n\`\`\``
        break
      case "optimize":
        prompt = `Optimize this ${selectedLanguage} code:\n\`\`\`${selectedLanguage}\n${selectedCode}\n\`\`\``
        break
      case "generate":
        prompt = `Generate a ${selectedLanguage} function that...`
        break
    }
    if (prompt) {
      setInputValue(prompt)
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content:
          "Chat cleared. How can I help you with your code today? Ask me about code generation, debugging, explanations, optimization, best practices, or comparisons.",
        timestamp: new Date(),
      },
    ])
    chatbot.clearHistory()
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Errorless AI Assistant
        </h3>
        <p className="text-xs text-muted-foreground mt-1">Your coding companion</p>
      </div>

      {/* Quick Actions */}
      {selectedCode && (
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 bg-transparent"
            onClick={() => handleQuickAction("debug")}
          >
            Debug
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 bg-transparent"
            onClick={() => handleQuickAction("explain")}
          >
            Explain
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 bg-transparent"
            onClick={() => handleQuickAction("optimize")}
          >
            Optimize
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-muted text-muted-foreground rounded-bl-none"
              }`}
            >
              <div className="text-sm">
                <ReactMarkdown
                  components={{
                    code: ({ inline, children }: any) =>
                      inline ? (
                        <code className="bg-background/50 px-1 rounded text-xs">{children}</code>
                      ) : (
                        <pre className="bg-background/50 p-2 rounded mt-2 overflow-x-auto text-xs">
                          <code>{children}</code>
                        </pre>
                      ),
                    a: ({ children, href }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
              {message.role === "assistant" && (
                <div className="flex gap-2 mt-2 opacity-0 hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => handleCopyMessage(message.content)}
                  >
                    <Copy size={12} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* NLP Analysis Toggle */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-between text-xs h-7"
          onClick={() => setShowNLPAnalysis(!showNLPAnalysis)}
        >
          <span>NLP Analysis</span>
          <ChevronDown size={14} className={`transition-transform ${showNLPAnalysis ? "rotate-180" : ""}`} />
        </Button>
        {showNLPAnalysis && messages.length > 0 && messages[messages.length - 1].nlpAnalysis && (
          <div className="mt-2 p-2 bg-background rounded text-xs space-y-1">
            <div>
              <span className="font-semibold">Intent:</span> {messages[messages.length - 1].nlpAnalysis?.intent}
            </div>
            <div>
              <span className="font-semibold">Language:</span>{" "}
              {messages[messages.length - 1].nlpAnalysis?.detectedLanguage}
            </div>
            <div>
              <span className="font-semibold">Sentiment:</span> {messages[messages.length - 1].nlpAnalysis?.sentiment}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border bg-card space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Ask Errorless for help..."
            className="flex-1 px-3 py-2 bg-input text-foreground rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button size="sm" onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()} className="gap-2">
            <Send size={14} />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={handleClearChat}>
            <Trash2 size={12} />
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
