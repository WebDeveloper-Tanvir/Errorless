"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, File, Folder, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface FileNode {
  id: string
  name: string
  type: "file" | "folder"
  children?: FileNode[]
  content?: string
  language?: string
}

interface FileExplorerProps {
  files: FileNode[]
  onSelectFile: (file: FileNode) => void
  onCreateFile: (parentId: string, name: string) => void
  onCreateFolder: (parentId: string, name: string) => void
  onDeleteFile: (fileId: string) => void
  selectedFileId?: string
}

export function FileExplorer({
  files,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  selectedFileId,
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [newItemName, setNewItemName] = useState("")
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(null)

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const handleCreateItem = (parentId: string, type: "file" | "folder") => {
    setCreatingIn(parentId)
    setCreatingType(type)
    setNewItemName("")
  }

  const handleConfirmCreate = () => {
    if (newItemName.trim() && creatingIn && creatingType) {
      if (creatingType === "file") {
        onCreateFile(creatingIn, newItemName)
      } else {
        onCreateFolder(creatingIn, newItemName)
      }
      setCreatingIn(null)
      setCreatingType(null)
      setNewItemName("")
    }
  }

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1 hover:bg-sidebar-accent cursor-pointer group ${
            selectedFileId === node.id ? "bg-sidebar-primary text-sidebar-primary-foreground" : ""
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.type === "folder" ? (
            <>
              <button onClick={() => toggleFolder(node.id)} className="p-0 hover:bg-sidebar-accent rounded">
                {expandedFolders.has(node.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <Folder size={16} className="text-yellow-500" />
            </>
          ) : (
            <>
              <div className="w-4" />
              <File size={16} className="text-blue-400" />
            </>
          )}
          <span className="flex-1 text-sm truncate" onClick={() => node.type === "file" && onSelectFile(node)}>
            {node.name}
          </span>
          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
            {node.type === "folder" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleCreateItem(node.id, "file")}
                >
                  <Plus size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleCreateItem(node.id, "folder")}
                >
                  <Folder size={14} />
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive"
              onClick={() => onDeleteFile(node.id)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        {node.type === "folder" && expandedFolders.has(node.id) && node.children && (
          <div>
            {creatingIn === node.id && creatingType && (
              <div className="flex items-center gap-2 px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
                <input
                  autoFocus
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmCreate()
                    if (e.key === "Escape") setCreatingIn(null)
                  }}
                  placeholder={`New ${creatingType}...`}
                  className="flex-1 px-2 py-1 bg-input text-foreground rounded text-sm"
                />
              </div>
            )}
            {renderFileTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border">
        <h3 className="font-semibold text-sm">Explorer</h3>
      </div>
      <div className="flex-1 overflow-y-auto">{renderFileTree(files)}</div>
    </div>
  )
}
