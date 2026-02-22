"use client"

import { useState, useCallback } from "react"
import { FileExplorer, type FileNode } from "./file-explorer"
import { CodeEditorIDE } from "./code-editor-ide"
import { Terminal } from "./terminal"
import { FileSystem } from "@/lib/file-system"
import { ErrorlessChatbotPanel } from "./errorless-chatbot-panel"

export function IDEContainer() {
  const [fileSystem] = useState(() => new FileSystem())
  const [files, setFiles] = useState<FileNode[]>(fileSystem.getFiles())
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [openFiles, setOpenFiles] = useState<FileNode[]>([])

  const handleSelectFile = useCallback(
    (file: FileNode) => {
      setSelectedFile(file)
      if (!openFiles.find((f) => f.id === file.id)) {
        setOpenFiles((prev) => [...prev, file])
      }
    },
    [openFiles],
  )

  const handleCreateFile = useCallback(
    (parentId: string, name: string) => {
      const newFile = fileSystem.createFile(parentId, name)
      setFiles([...fileSystem.getFiles()])
      handleSelectFile(newFile)
    },
    [fileSystem, handleSelectFile],
  )

  const handleCreateFolder = useCallback(
    (parentId: string, name: string) => {
      fileSystem.createFolder(parentId, name)
      setFiles([...fileSystem.getFiles()])
    },
    [fileSystem],
  )

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      fileSystem.deleteFile(fileId)
      setFiles([...fileSystem.getFiles()])
      if (selectedFile?.id === fileId) {
        setSelectedFile(null)
      }
      setOpenFiles((prev) => prev.filter((f) => f.id !== fileId))
    },
    [fileSystem, selectedFile],
  )

  const handleContentChange = useCallback(
    (content: string) => {
      if (selectedFile) {
        fileSystem.updateFileContent(selectedFile.id, content)
        setSelectedFile({ ...selectedFile, content })
        setOpenFiles((prev) => prev.map((f) => (f.id === selectedFile.id ? { ...f, content } : f)))
      }
    },
    [fileSystem, selectedFile],
  )

  const handleRunCode = async (code: string, language: string): Promise<string> => {
    // Simulate code execution
    try {
      if (language === "python") {
        return simulatePythonExecution(code)
      } else if (language === "javascript") {
        return simulateJavaScriptExecution(code)
      } else {
        return `Code execution for ${language} is simulated.\n\nCode:\n${code}`
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }

  const handleCloseFile = useCallback(
    (fileId: string) => {
      setOpenFiles((prev) => prev.filter((f) => f.id !== fileId))
      if (selectedFile?.id === fileId) {
        setSelectedFile(null)
      }
    },
    [selectedFile],
  )

  return (
    <div className="flex h-screen bg-background">
      {/* File Explorer */}
      <div className="w-64 border-r border-border overflow-hidden">
        <FileExplorer
          files={files}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onDeleteFile={handleDeleteFile}
          selectedFileId={selectedFile?.id}
        />
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Open Files Tabs */}
        {openFiles.length > 0 && (
          <div className="flex gap-2 px-4 py-2 border-b border-border bg-card overflow-x-auto">
            {openFiles.map((file) => (
              <button
                key={file.id}
                onClick={() => setSelectedFile(file)}
                className={`px-3 py-1 rounded text-sm whitespace-nowrap flex items-center gap-2 ${
                  selectedFile?.id === file.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {(file as any).name}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseFile(file.id)
                  }}
                  className="ml-1 hover:text-foreground"
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        )}

        {/* Code Editor */}
        <div className="flex-1 overflow-hidden">
          <CodeEditorIDE
            file={selectedFile}
            onContentChange={handleContentChange}
            onClose={() => selectedFile && handleCloseFile(selectedFile.id)}
          />
        </div>

        {/* Terminal */}
        <div className="h-48 border-t border-border">
          <Terminal
            onRunCode={handleRunCode}
            currentLanguage={selectedFile?.language || "python"}
            currentCode={selectedFile?.content || ""}
          />
        </div>
      </div>

      <div className="w-80 border-l border-border overflow-hidden flex flex-col">
        <ErrorlessChatbotPanel selectedCode={selectedFile?.content} selectedLanguage={selectedFile?.language} />
      </div>
    </div>
  )
}

// Simulate Python code execution
function simulatePythonExecution(code: string): string {
  const output: string[] = []

  // Simple simulation - extract print statements
  const printMatches = code.match(/print$$[^)]*$$/g) || []
  if (printMatches.length === 0) {
    return "Code executed successfully (no output)"
  }

  printMatches.forEach((match) => {
    const content = match.replace(/print$$["']?([^"')]*?)["']?$$/g, "$1")
    output.push(content)
  })

  return output.join("\n") || "Code executed successfully"
}

// Simulate JavaScript code execution
function simulateJavaScriptExecution(code: string): string {
  const output: string[] = []

  // Simple simulation - extract console.log statements
  const logMatches = code.match(/console\.log$$[^)]*$$/g) || []
  if (logMatches.length === 0) {
    return "Code executed successfully (no output)"
  }

  logMatches.forEach((match) => {
    const content = match.replace(/console\.log$$["']?([^"')]*?)["']?$$/g, "$1")
    output.push(content)
  })

  return output.join("\n") || "Code executed successfully"
}
