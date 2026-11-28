"use client"

import { useState, useCallback } from "react"
import { FileExplorer, type FileNode } from "./file-explorer"
import { CodeEditorIDE } from "./code-editor-ide"
import { BottomPanel } from "./bottom-panel"
import { CommandPalette } from "./command-palette"
import { FileSystem } from "@/lib/file-system"
import { detectLanguage } from "@/lib/ide/language"
import { flattenProject } from "@/lib/ide/project"
import { ErrorlessChatbotPanel } from "./errorless-chatbot-panel"
import { PreviewPane } from "./preview-pane"
import { useIdeRuntime } from "./use-ide-runtime"
import { terminalText } from "@/lib/ide/events"
import { Code2, Globe, PanelLeftOpen, PanelRightOpen, Play, Square, X } from "lucide-react"
import Link from "next/link"

export function IDEContainer() {
  const [fileSystem]  = useState(() => new FileSystem())
  const [files, setFiles]            = useState<FileNode[]>(fileSystem.getFiles())
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [openFiles, setOpenFiles]    = useState<FileNode[]>([])
  const [cmdOpen, setCmdOpen]        = useState(false)
  const [showExplorer, setShowExplorer] = useState(true)
  const [showChat, setShowChat]      = useState(true)
  const getTree = useCallback(() => fileSystem.getFiles(), [fileSystem])
  const rt = useIdeRuntime(getTree)
  const [selection, setSelection] = useState<{ text: string; start: number; end: number } | null>(null)

  /** Context for the AI assistant, read at the moment an action runs. */
  const assistantContext = useCallback(() => {
    const f = selectedFile
    const evs = rt.events
    const lastCmd = [...evs].map((e) => e.kind).lastIndexOf("command")
    const sinceRun = evs.slice(lastCmd + 1)
    const errLines = sinceRun.filter((e) => e.kind === "stderr" || e.kind === "error").map((e) => e.text)
    const ctx = {
      filename: f?.name,
      language: f ? detectLanguage(f.name).label : undefined,
      code: f ? flattenProject(fileSystem.getFiles()).find((x) => x.id === f.id)?.content ?? f.content : undefined,
      selection: selection?.text,
      error: errLines.join("\n") || undefined,
      terminal: evs.slice(-40).map(terminalText).join("\n") || undefined,
    }
    return { ctx, scope: f ? { fileId: f.id, fileName: f.name, selection: selection ?? undefined } : undefined }
  }, [selectedFile, selection, rt.events, fileSystem])

  const getFileContent = useCallback((id: string) => flattenProject(fileSystem.getFiles()).find((x) => x.id === id)?.content ?? null, [fileSystem])
  const applyToFile = useCallback((id: string, next: string) => {
    fileSystem.updateFileContent(id, next)
    setSelection(null)
    setSelectedFile((f) => (f && f.id === id ? { ...f, content: next } : f))
    setOpenFiles((p) => p.map((f) => (f.id === id ? { ...f, content: next } : f)))
  }, [fileSystem])

  const handleSelectFile = useCallback((file: FileNode) => {
    setSelectedFile(file)
    rt.setActive(file.id)
    if (!openFiles.find(f => f.id === file.id)) setOpenFiles(p => [...p, file])
  }, [openFiles, rt])

  const handleCreateFile = useCallback((parentId: string, name: string) => {
    const f = fileSystem.createFile(parentId, name)
    setFiles([...fileSystem.getFiles()])
    handleSelectFile(f)
  }, [fileSystem, handleSelectFile])

  const handleCreateFolder = useCallback((parentId: string, name: string) => {
    fileSystem.createFolder(parentId, name)
    setFiles([...fileSystem.getFiles()])
  }, [fileSystem])

  const handleDeleteFile = useCallback((fileId: string) => {
    fileSystem.deleteFile(fileId)
    setFiles([...fileSystem.getFiles()])
    if (selectedFile?.id === fileId) setSelectedFile(null)
    setOpenFiles(p => p.filter(f => f.id !== fileId))
  }, [fileSystem, selectedFile])

  const handleContentChange = useCallback((content: string) => {
    if (selectedFile) {
      fileSystem.updateFileContent(selectedFile.id, content)
      setSelectedFile({ ...selectedFile, content })
      setOpenFiles(p => p.map(f => f.id === selectedFile.id ? { ...f, content } : f))
    }
  }, [fileSystem, selectedFile])

  const handleCloseFile = useCallback((fileId: string) => {
    setOpenFiles(p => p.filter(f => f.id !== fileId))
    if (selectedFile?.id === fileId) setSelectedFile(null)
  }, [selectedFile])

  // Language badge color
  const langColor: Record<string, string> = {
    python: "#00c9a7", javascript: "#ffd166", typescript: "#00b4d8",
    java: "#ff6b6b", cpp: "#4361ee", c: "#4361ee", rust: "#ff9f43", html: "#ff7a45", css: "#8b5cf6",
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#030e09", fontFamily: "'Syne', sans-serif" }}>

      {/* ── Top title bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 shrink-0"
        style={{ height: 40, borderBottom: "1px solid rgba(0,201,167,0.1)", background: "rgba(2,10,6,0.95)" }}>

        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-6 h-6 shrink-0">
            <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-60 blur-[5px] transition-opacity"
              style={{ background: "linear-gradient(135deg, #00c9a7, #4361ee)" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/errorless-logo.jpg" alt="Errorless"
              className="relative w-6 h-6 rounded-md object-cover"
              style={{ boxShadow: "0 0 0 1px rgba(0,201,167,0.2)" }} />
          </div>
          <span className="text-xs font-bold tracking-wide">
            <span style={{ color: "#4361ee" }}>error</span>
            <span style={{ color: "#fff" }}>less</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold tracking-widest uppercase"
            style={{ background: "rgba(0,201,167,0.1)", color: "#00c9a7", border: "1px solid rgba(0,201,167,0.2)" }}>
            IDE
          </span>
        </Link>

        {/* Center: panel toggles */}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowExplorer(s => !s)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
            style={{
              background: showExplorer ? "rgba(0,201,167,0.12)" : "transparent",
              color: showExplorer ? "#00c9a7" : "rgba(200,230,220,0.35)",
              border: `1px solid ${showExplorer ? "rgba(0,201,167,0.25)" : "transparent"}`,
            }}>
            <PanelLeftOpen size={12} /> Explorer
          </button>
          <button onClick={() => setShowChat(s => !s)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
            style={{
              background: showChat ? "rgba(0,201,167,0.12)" : "transparent",
              color: showChat ? "#00c9a7" : "rgba(200,230,220,0.35)",
              border: `1px solid ${showChat ? "rgba(0,201,167,0.25)" : "transparent"}`,
            }}>
            <PanelRightOpen size={12} /> AI Chat
          </button>
          <button onClick={() => rt.setPreviewOpen(!rt.previewOpen)} aria-pressed={rt.previewOpen}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
            style={{
              background: rt.previewOpen ? "rgba(0,201,167,0.12)" : "transparent",
              color: rt.previewOpen ? "#00c9a7" : "rgba(200,230,220,0.35)",
              border: `1px solid ${rt.previewOpen ? "rgba(0,201,167,0.25)" : "transparent"}`,
            }}>
            <Globe size={12} /> Preview
          </button>
          <span className="w-px h-4 mx-1" style={{ background: "rgba(0,201,167,0.15)" }} />
          <button onClick={() => selectedFile && void rt.run({ id: selectedFile.id })}
            disabled={!selectedFile || rt.running} title={selectedFile ? `Run ${selectedFile.name}` : "Open a file to run it"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(0,207,255,0.14)", color: "#00CFFF", border: "1px solid rgba(0,207,255,0.3)" }}>
            <Play size={12} /> Run
          </button>
          <button onClick={rt.stop} disabled={!rt.running} title="Stop execution"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all disabled:opacity-40"
            style={{ background: "rgba(255,77,109,0.1)", color: "#ff4d6d", border: "1px solid rgba(255,77,109,0.25)" }}>
            <Square size={11} /> Stop
          </button>
        </div>

        {/* Right: file name indicator */}
        <div className="flex items-center gap-2">
          {selectedFile && (
            <span className="text-[10px] font-mono text-[rgba(200,230,220,0.4)]">{selectedFile.name}</span>
          )}
          <div className="w-1.5 h-1.5 rounded-full bg-[#00c9a7]"
            style={{ boxShadow: "0 0 6px rgba(0,201,167,0.8)" }} />
        </div>
      </div>

      {/* ── Main layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* File Explorer */}
        {showExplorer && (
          <div className="w-56 shrink-0 overflow-hidden">
            <FileExplorer
              files={files}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onDeleteFile={handleDeleteFile}
              selectedFileId={selectedFile?.id}
            />
          </div>
        )}

        {/* Center: editor + bottom panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

          {/* ── File tabs ────────────────────────────────────────── */}
          {openFiles.length > 0 && (
            <div className="flex items-end gap-px px-2 pt-1 shrink-0 overflow-x-auto"
              style={{ borderBottom: "1px solid rgba(0,201,167,0.1)", background: "rgba(2,10,6,0.7)" }}>
              {openFiles.map(file => {
                const isActive = selectedFile?.id === file.id
                const lang = detectLanguage(file.name).id
                const dotColor = langColor[lang] ?? "#00c9a7"
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all shrink-0 rounded-t-lg relative"
                    style={{
                      background: isActive ? "rgba(0,201,167,0.08)" : "transparent",
                      borderTop: isActive ? "1px solid rgba(0,201,167,0.3)" : "1px solid transparent",
                      borderLeft: isActive ? "1px solid rgba(0,201,167,0.15)" : "1px solid transparent",
                      borderRight: isActive ? "1px solid rgba(0,201,167,0.15)" : "1px solid transparent",
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                    <span className={`text-xs font-medium tracking-wide ${isActive ? "text-[#00c9a7]" : "text-[rgba(200,230,220,0.45)]"}`}>
                      {file.name}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); handleCloseFile(file.id) }}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleCloseFile(file.id) } }}
                      className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all"
                      style={{ color: "rgba(200,230,220,0.3)" }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLSpanElement).style.background = "rgba(255,77,109,0.15)"
                        ;(e.currentTarget as HTMLSpanElement).style.color = "#ff4d6d"
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLSpanElement).style.background = "transparent"
                        ;(e.currentTarget as HTMLSpanElement).style.color = "rgba(200,230,220,0.3)"
                      }}
                    >
                      <X size={10} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Editor area ──────────────────────────────────────── */}
          <div className="flex-1 overflow-hidden min-h-0">
            {selectedFile ? (
              <CodeEditorIDE
                file={selectedFile}
                onContentChange={handleContentChange}
                onClose={() => selectedFile && handleCloseFile(selectedFile.id)}
                onSelectionChange={setSelection}
              />
            ) : (
              // Welcome screen
              <div className="h-full flex flex-col items-center justify-center gap-6"
                style={{ background: "#030e09" }}>
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl blur-2xl"
                    style={{ background: "radial-gradient(circle, rgba(0,201,167,0.15), rgba(67,97,238,0.1))" }} />
                  <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(0,201,167,0.12), rgba(67,97,238,0.12))", border: "1px solid rgba(0,201,167,0.2)" }}>
                    <Code2 size={36} style={{ color: "#00c9a7" }} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold" style={{ color: "rgba(200,230,220,0.8)" }}>
                    Select a file to start editing
                  </h2>
                  <p className="text-xs" style={{ color: "rgba(200,230,220,0.35)" }}>
                    Choose a file from the explorer or create a new one
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: "rgba(200,230,220,0.2)" }}>
                  <span>Python · JavaScript · TypeScript · Java · C++ · Go · Rust</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom panel ─────────────────────────────────────── */}
          <BottomPanel
            events={rt.events}
            problems={rt.problems}
            running={rt.running}
            onCommand={rt.command}
            onClearProblems={rt.clearProblems}
          />
        </div>

        <PreviewPane
          preview={rt.preview}
          open={rt.previewOpen}
          running={rt.running}
          iframeRef={rt.iframeRef}
          onClose={() => rt.setPreviewOpen(false)}
          onRefresh={rt.refresh}
          onStop={rt.stop}
        />

        {/* AI Chatbot panel */}
        {showChat && (
          <div className="w-[340px] shrink-0 overflow-hidden">
            <ErrorlessChatbotPanel
              getContext={assistantContext}
              getFileContent={getFileContent}
              onApply={applyToFile}
            />
          </div>
        )}
      </div>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
