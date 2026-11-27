import { CONTENT_UPDATED } from "./site.ts"

/**
 * Content for the public error-debugging pages (/tools/[slug]).
 * Every page has its own explanations, examples and FAQ. The `errors` list is used twice:
 * rendered as the guide on the page and compiled into the pattern matcher behind the demo,
 * so what the demo says is exactly what the page documents.
 */

export interface KnownError {
  id: string
  title: string
  /** A realistic message as the developer would see it. */
  example: string
  /** Regex source (case-insensitive). Capture groups can be used as $1, $2 in why/fix. */
  pattern: string
  why: string
  fix: string
  before: string
  after: string
  codeLang: string
}

export interface ToolPage {
  slug: string
  /** H1 and link label. */
  name: string
  navLabel: string
  metaTitle: string
  metaDescription: string
  /** Value for the Dev Mode language selector. */
  debugLanguage: string
  debugFramework: string
  /** File extension for the in-browser static analyzer; undefined when it does not apply. */
  analyzerExt?: "py" | "js" | "ts" | "tsx" | "jsx"
  intro: string[]
  approach: { title: string; body: string }[]
  errors: KnownError[]
  checklist: string[]
  faqs: { q: string; a: string }[]
  related: string[]
  demoError: string
  demoCode?: string
  updated: string
}

const U = CONTENT_UPDATED

export const TOOL_PAGES: ToolPage[] = [
  // ───────────────────────── Python ─────────────────────────
  {
    slug: "python-error-fixer",
    name: "AI Python Error Fixer",
    navLabel: "Python",
    metaTitle: "Python Error Fixer: Explain Tracebacks and Fix Bugs",
    metaDescription: "Paste a Python traceback and learn what KeyError, ModuleNotFoundError, NoneType and IndentationError mean, why they happen and how to fix them.",
    debugLanguage: "python",
    debugFramework: "None / plain language",
    analyzerExt: "py",
    intro: [
      "A Python traceback reads from the bottom up: the last line names the exception, and the frame just above it is where the program actually gave up. Most of the time that frame is a symptom. The real cause is a value that was wrong a few calls earlier, such as a dictionary built with different keys than the code expects, or a function that quietly returned None.",
      "This page explains the Python errors developers search for most, shows the smallest change that fixes each one, and lets you paste your own traceback to see which pattern it matches.",
    ],
    approach: [
      { title: "Start with the exception type", body: "KeyError, AttributeError and TypeError each point to a different kind of mistake. Naming the type first narrows the search from the whole program to one kind of bug." },
      { title: "Find the value that was already wrong", body: "The failing line usually reads a bad value that an earlier line produced. Errorless asks which variable is wrong and where it was last assigned, rather than only restating the message." },
      { title: "Change as little as possible", body: "A fix that renames one key or adds one guard keeps your intended behavior. Rewriting the function hides the bug and creates new ones." },
    ],
    errors: [
      {
        id: "keyerror", title: "KeyError: the dictionary has no such key", example: "KeyError: 'qty'",
        pattern: "KeyError:\\s*['\"]?([^'\"\\n]+)['\"]?",
        why: "The code looks up the key '$1', but the dictionary does not contain it. Usually the data uses a different spelling ('quantity' instead of 'qty'), or the key is optional and was never set.",
        fix: "Print the dictionary's keys at the failing line to see the real name, then use it. If the key is genuinely optional, read it with .get() and a default.",
        before: "total += item[\"price\"] * item[\"qty\"]", after: "total += item[\"price\"] * item.get(\"quantity\", 1)", codeLang: "python",
      },
      {
        id: "modulenotfound", title: "ModuleNotFoundError: No module named", example: "ModuleNotFoundError: No module named 'requests'",
        pattern: "ModuleNotFoundError:\\s*No module named ['\"]([\\w.]+)['\"]",
        why: "The interpreter running your script cannot import '$1'. Either the package is not installed in this environment, or you installed it for a different Python than the one that runs the script.",
        fix: "Install it with the same interpreter: python -m pip install <package>. Check which interpreter runs with python -c \"import sys; print(sys.executable)\". For your own files, check the package folder and the working directory.",
        before: "pip install requests   # may target another Python", after: "python -m pip install requests", codeLang: "bash",
      },
      {
        id: "nonetype", title: "AttributeError: 'NoneType' object has no attribute", example: "AttributeError: 'NoneType' object has no attribute 'group'",
        pattern: "AttributeError:\\s*'NoneType' object has no attribute ['\"](\\w+)['\"]",
        why: "Something returned None and the next line called .$1 on it. Functions that find or search (re.match, dict.get, a database lookup) return None when nothing matches, and a function without return also yields None.",
        fix: "Check the value before using it, and decide what the program should do when there is no result. Also confirm the function you call actually returns the value.",
        before: "m = re.match(r\"(\\d+)\", text)\nprint(m.group(1))", after: "m = re.match(r\"(\\d+)\", text)\nif m:\n    print(m.group(1))", codeLang: "python",
      },
      {
        id: "indentation", title: "IndentationError: unexpected indent or expected an indented block", example: "IndentationError: expected an indented block after 'if' statement on line 3",
        pattern: "(?:Indentation|Tab)Error:\\s*(unexpected indent|expected an indented block[^\\n]*|unindent does not match[^\\n]*|inconsistent use of tabs[^\\n]*)",
        why: "Python uses indentation as syntax. The message \"$1\" means a block is empty, a line is indented more or less than its neighbours, or tabs and spaces are mixed in the same block.",
        fix: "Indent the body of every if, for, def and class by the same amount, use pass for an intentionally empty block, and configure your editor to insert 4 spaces for Tab.",
        before: "if ready:\nprint(\"go\")", after: "if ready:\n    print(\"go\")", codeLang: "python",
      },
    ],
    checklist: [
      "Read the last line first, then the frame directly above it.",
      "Open the file and line from that frame and note which variable is wrong.",
      "Print or log that variable just before the failing line.",
      "Trace it back to where it was assigned or returned.",
      "Fix the source of the wrong value, not only the line that crashed.",
    ],
    faqs: [
      { q: "Why does Python show the error on a line that looks fine?", a: "The failing line often reads a value that an earlier line produced incorrectly. The traceback shows where the program stopped, not where the mistake began, so follow the variable backwards." },
      { q: "Can Errorless run my Python code?", a: "No. Errorless never executes your code. The pattern explainer on this page runs in your browser, and AI analysis in Dev Mode reasons about the text you submit. Run the verification commands it suggests yourself." },
      { q: "Is the explainer on this page the full AI analysis?", a: "No. This page matches your error against the documented patterns above. For analysis of your own code, with evidence quoted from it, use Dev Mode." },
    ],
    related: ["javascript-error-debugger", "sql-error-explainer", "docker-error-debugger"],
    demoError: "Traceback (most recent call last):\n  File \"app.py\", line 7, in <module>\n    print(total_price(order))\n  File \"app.py\", line 4, in total_price\n    total += item[\"price\"] * item[\"qty\"]\nKeyError: 'qty'",
    demoCode: "def total_price(order):\n    total = 0\n    for item in order[\"items\"]:\n        total += item[\"price\"] * item[\"qty\"]\n    return total\n\n\nprint(total_price({\"items\": [{\"price\": 10, \"quantity\": 2}]}))\n",
    updated: U,
  },

  // ───────────────────────── JavaScript ─────────────────────────
  {
    slug: "javascript-error-debugger",
    name: "JavaScript Error Debugger",
    navLabel: "JavaScript",
    metaTitle: "JavaScript Error Debugger: Fix Undefined and Type Errors",
    metaDescription: "Decode JavaScript errors like 'Cannot read properties of undefined', 'is not defined', 'is not a function' and JSON parse failures, with causes and fixes.",
    debugLanguage: "javascript",
    debugFramework: "None / plain language",
    analyzerExt: "js",
    intro: [
      "JavaScript rarely fails where the mistake is. A value is undefined because a network call has not finished, a property was renamed, or a function was passed where an object was expected, and the crash only happens later, on the first line that touches it.",
      "Below are the JavaScript runtime errors that come up most often, what each one tells you about your data, and the smallest fix. Paste a browser console or Node error to see which one it matches.",
    ],
    approach: [
      { title: "Read the property, not just the type", body: "\"Cannot read properties of undefined (reading 'map')\" tells you two things: the value is undefined, and the code was calling .map on it. The second part usually names the variable to check." },
      { title: "Check timing before logic", body: "Data from fetch, events or state is often not there yet on the first run. Many undefined errors disappear with a loading guard or a sensible default, not new logic." },
      { title: "Prefer guards at the boundary", body: "Validate or default the value where it enters your code. Sprinkling optional chaining everywhere hides which data is actually missing." },
    ],
    errors: [
      {
        id: "undefined-property", title: "TypeError: Cannot read properties of undefined or null", example: "TypeError: Cannot read properties of undefined (reading 'map')",
        pattern: "Cannot read propert(?:y|ies) of (undefined|null)(?: \\(reading '([^']+)'\\))?",
        why: "The code accessed .$2 on a value that is $1. The variable was never set, was set later than it is used (async data), or the object does not have the nesting you assumed.",
        fix: "Find which variable is $1 at that line, give it a default where it is created, and only render or loop once it exists.",
        before: "const [users, setUsers] = useState()\nreturn users.map(u => u.name)", after: "const [users, setUsers] = useState([])\nreturn users.map(u => u.name)", codeLang: "javascript",
      },
      {
        id: "not-defined", title: "ReferenceError: x is not defined", example: "ReferenceError: userName is not defined",
        pattern: "ReferenceError:\\s*([\\w$]+) is not defined",
        why: "The name '$1' is used where no variable with that name exists in scope. Typical causes are a typo, a variable declared inside a different block or function, or a missing import.",
        fix: "Check the spelling, then check where '$1' is declared and whether that scope includes the line that uses it. Import it if it comes from another module.",
        before: "if (ok) { const userName = 'Ada' }\nconsole.log(userName)", after: "let userName\nif (ok) { userName = 'Ada' }\nconsole.log(userName)", codeLang: "javascript",
      },
      {
        id: "not-a-function", title: "TypeError: x is not a function", example: "TypeError: items.forEach is not a function",
        pattern: "TypeError:\\s*([\\w$.\\[\\]()]+) is not a function",
        why: "$1 was called like a function, but at runtime it holds something else: often an object instead of an array, undefined, or a default import that should have been a named import.",
        fix: "Log typeof and the value of the thing you call. If an API returns an object with the array inside, read that property. For imports, compare default and named export usage.",
        before: "const items = await res.json() // { data: [...] }\nitems.forEach(render)", after: "const { data: items } = await res.json()\nitems.forEach(render)", codeLang: "javascript",
      },
      {
        id: "json-unexpected-token", title: "SyntaxError: Unexpected token '<' in JSON", example: "Uncaught SyntaxError: Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
        pattern: "Unexpected token '?<'?.*(?:JSON|DOCTYPE)|is not valid JSON|Unexpected end of JSON input",
        why: "response.json() received something that is not JSON, most often an HTML error or login page. The URL is wrong, the server returned an error page, or a dev server is rewriting unknown routes to index.html. An empty body gives 'Unexpected end of JSON input'.",
        fix: "Check response.ok and the Content-Type header before parsing, and log the first part of response.text() to see what came back. Then fix the URL or the server error.",
        before: "const data = await fetch(url).then(r => r.json())", after: "const res = await fetch(url)\nif (!res.ok) throw new Error(`HTTP ${res.status}`)\nconst data = await res.json()", codeLang: "javascript",
      },
    ],
    checklist: [
      "Open the line from the stack trace and highlight the value being read or called.",
      "Log that value and its type right before the line.",
      "Ask whether it could be missing on the first run (async data, optional field).",
      "Fix it where the value is created or fetched.",
      "Reload with the network tab open to confirm the data shape.",
    ],
    faqs: [
      { q: "Should I just add optional chaining (?.) everywhere?", a: "Use it where a missing value is expected. Used everywhere, it turns a loud error into silent wrong output and makes it harder to see which data is actually missing." },
      { q: "Does this page work for Node.js errors?", a: "The JavaScript language errors here apply to Node too. Errors specific to Node, such as missing modules or ports in use, are on the Node.js error fixer page." },
      { q: "Does Errorless see my code when I use the explainer?", a: "No. The pattern explainer runs in your browser and nothing you paste on this page is sent to a server. The optional code check also runs locally." },
    ],
    related: ["typescript-error-solver", "react-error-debugger", "nodejs-error-fixer"],
    demoError: "Uncaught TypeError: Cannot read properties of undefined (reading 'map')\n    at UserList (UserList.js:12:14)",
    demoCode: "let users\nfetch('/api/users').then(r => r.json()).then(d => { users = d })\nconsole.log(users.map(u => u.name))\n",
    updated: U,
  },

  // ───────────────────────── TypeScript ─────────────────────────
  {
    slug: "typescript-error-solver",
    name: "TypeScript Error Solver",
    navLabel: "TypeScript",
    metaTitle: "TypeScript Error Solver: Fix TS2322, TS2339 and More",
    metaDescription: "Understand TypeScript compiler errors such as TS2322, TS2339, TS2532 and TS2307. See why the type checker complains and the smallest typed fix.",
    debugLanguage: "typescript",
    debugFramework: "None / plain language",
    analyzerExt: "ts",
    intro: [
      "A TypeScript error is the compiler disagreeing with you about a type. The useful part is the pair of types it names: what it found, and what it expected. The fix is almost always to correct one of those two, not to silence the check.",
      "This page covers the compiler errors developers hit most, explains what each is really saying, and shows a typed fix that keeps the code safe. Paste a compiler message to see which pattern matches.",
    ],
    approach: [
      { title: "Read both types", body: "\"Type 'string' is not assignable to type 'number'\" gives you the found type and the expected type. Decide which of the two is wrong before touching the code." },
      { title: "Narrow instead of casting", body: "A type guard or an early return tells the compiler what you already know. A cast with 'as' only hides the problem and can crash at runtime." },
      { title: "Avoid any as a fix", body: "Typing something as any removes the error and the protection with it. The error often points at data that really can be missing." },
    ],
    errors: [
      {
        id: "ts2322", title: "TS2322: Type is not assignable to type", example: "error TS2322: Type 'string | undefined' is not assignable to type 'string'.",
        pattern: "TS2322:\\s*Type '([^']+)' is not assignable to type '([^']+)'",
        why: "A value of type '$1' is used where '$2' is required. The most common cause is a value that can be undefined or null being passed to something that needs a definite value.",
        fix: "Either make the value definite (check it, or provide a default) or widen the destination type if undefined is truly allowed there.",
        before: "const name: string = user.nickname // string | undefined", after: "const name: string = user.nickname ?? \"Anonymous\"", codeLang: "typescript",
      },
      {
        id: "possibly-undefined", title: "TS2532 / TS18048: Object is possibly undefined", example: "error TS18048: 'user' is possibly 'undefined'.",
        pattern: "TS2532|TS18048|TS2531|is possibly '(undefined|null)'|Object is possibly '?(?:undefined|null)'?",
        why: "The compiler found a path where the value is $1 and the code uses it without checking. It is warning about a real possible crash.",
        fix: "Check before use with an if or an early return so TypeScript narrows the type. Use optional chaining only when skipping the access is the correct behavior.",
        before: "function greet(user?: User) {\n  return user.name\n}", after: "function greet(user?: User) {\n  if (!user) return \"Hello\"\n  return user.name\n}", codeLang: "typescript",
      },
      {
        id: "ts2339", title: "TS2339: Property does not exist on type", example: "error TS2339: Property 'email' does not exist on type 'User'.",
        pattern: "TS2339:\\s*Property '([^']+)' does not exist on type '([^']+)'",
        why: "The type '$2' has no member called '$1'. Either the name is misspelled, the property exists on a different type (for example after a union), or the interface was never updated when the data changed.",
        fix: "Add the property to the type if the data really has it, narrow a union before reading the property, or correct the name.",
        before: "interface User { id: number }\nconsole.log(user.email)", after: "interface User { id: number; email: string }\nconsole.log(user.email)", codeLang: "typescript",
      },
      {
        id: "ts2307", title: "TS2307: Cannot find module or its type declarations", example: "error TS2307: Cannot find module './utils' or its corresponding type declarations.",
        pattern: "TS2307:\\s*Cannot find module '([^']+)'",
        why: "TypeScript cannot resolve '$1'. The path may be wrong, the file extension or casing may not match, a package may be missing its @types, or tsconfig paths and moduleResolution do not match how you import.",
        fix: "Check the path and casing, install the package or its @types/<name>, and confirm tsconfig baseUrl, paths and moduleResolution match your bundler.",
        before: "import { slugify } from \"./utils\" // file is ./util.ts", after: "import { slugify } from \"./util\"", codeLang: "typescript",
      },
    ],
    checklist: [
      "Copy the full message including both type names.",
      "Hover the value in your editor to see the type TypeScript inferred.",
      "Decide whether the value or the destination type is wrong.",
      "Narrow with a check, give a default, or fix the declared type.",
      "Run tsc --noEmit to confirm no new errors appeared.",
    ],
    faqs: [
      { q: "Is it fine to use // @ts-ignore or as any?", a: "Occasionally, with a comment saying why. As a first reaction it removes the error and the safety, and the crash it was warning about can still happen at runtime." },
      { q: "Why does the error appear in a file I did not change?", a: "Types flow between files. Changing a type or a function signature in one place can break every caller. Start at the first error in the compiler output; later ones are often side effects." },
      { q: "Does Errorless type-check my project?", a: "No. The compiler is the authority on your types. Errorless explains what its messages mean and, in Dev Mode, suggests a fix you then check with tsc yourself." },
    ],
    related: ["javascript-error-debugger", "react-error-debugger", "nodejs-error-fixer"],
    demoError: "src/profile.ts(8,10): error TS2322: Type 'string | undefined' is not assignable to type 'string'.",
    demoCode: "interface User { nickname?: string }\n\nfunction label(user: User): string {\n  const name: string = user.nickname\n  return name\n}\n",
    updated: U,
  },

  // ───────────────────────── React ─────────────────────────
  {
    slug: "react-error-debugger",
    name: "React Error Debugger",
    navLabel: "React",
    metaTitle: "React Error Debugger: Hooks, Hydration and Render Errors",
    metaDescription: "Fix 'Invalid hook call', hydration mismatches, 'Too many re-renders' and 'Objects are not valid as a React child' with clear causes and tested patterns.",
    debugLanguage: "javascript",
    debugFramework: "React",
    analyzerExt: "jsx",
    intro: [
      "React errors come from the rules React relies on: hooks run in the same order every render, rendering is pure, and server and client output must match. When one of those rules breaks, the message names the rule, and the stack points at the component that broke it.",
      "This page explains four React errors that cost developers the most time, what rule each one is about, and the smallest change that fixes it. Paste a console error to see which pattern it matches.",
    ],
    approach: [
      { title: "Identify the rule that broke", body: "Invalid hook call, hydration mismatch and render loops each violate a different rule. Naming the rule tells you whether to look at hook placement, rendering output or state updates." },
      { title: "Look at the component named in the stack", body: "React prints the component where the problem was detected. Start there, then look at its parents for conditional hooks or props that change between server and client." },
      { title: "Move side effects out of render", body: "Anything that changes state, reads the browser, or uses randomness belongs in an event handler or an effect. Most render errors disappear when render becomes pure again." },
    ],
    errors: [
      {
        id: "invalid-hook", title: "Invalid hook call", example: "Error: Invalid hook call. Hooks can only be called inside of the body of a function component.",
        pattern: "Invalid hook call",
        why: "A hook ran somewhere React does not allow. The three usual causes are calling a hook inside a condition, loop or regular function; having two copies of React in node_modules; or mismatched react and react-dom versions.",
        fix: "Move the hook to the top level of a component or custom hook (name it use...). If the code is correct, run npm ls react react-dom and make sure there is exactly one version of each.",
        before: "function Panel({ open }) {\n  if (open) {\n    const [x, setX] = useState(0)\n  }\n}", after: "function Panel({ open }) {\n  const [x, setX] = useState(0)\n  if (!open) return null\n  return <div>{x}</div>\n}", codeLang: "jsx",
      },
      {
        id: "hydration", title: "Hydration failed: server and client HTML differ", example: "Error: Hydration failed because the initial UI does not match what was rendered on the server.",
        pattern: "Hydration failed|did not match\\.? (?:Server|Text content)|Text content does not match server-rendered HTML|hydrat",
        why: "The HTML rendered on the server is different from what the browser renders first. Typical sources are Date.now(), Math.random(), reading window or localStorage during render, or invalid HTML nesting such as a div inside a p.",
        fix: "Render the same output on both sides first, and apply browser-only values after mount in useEffect. For unavoidable differences, such as a timestamp, suppressHydrationWarning on that single element is a narrow escape hatch.",
        before: "return <p>{new Date().toLocaleTimeString()}</p>", after: "const [time, setTime] = useState(\"\")\nuseEffect(() => setTime(new Date().toLocaleTimeString()), [])\nreturn <p>{time}</p>", codeLang: "jsx",
      },
      {
        id: "too-many-rerenders", title: "Too many re-renders", example: "Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.",
        pattern: "Too many re-renders|Maximum update depth exceeded",
        why: "State is being updated during render, so every render triggers another. The classic mistake is onClick={setCount(count + 1)}, which calls the setter immediately instead of passing a function. An effect that sets state it also depends on does the same.",
        fix: "Pass a function to event props, and check the dependency array of any effect that sets state so it only re-runs when it should.",
        before: "<button onClick={setCount(count + 1)}>+</button>", after: "<button onClick={() => setCount(c => c + 1)}>+</button>", codeLang: "jsx",
      },
      {
        id: "object-as-child", title: "Objects are not valid as a React child", example: "Error: Objects are not valid as a React child (found: object with keys {id, name}).",
        pattern: "Objects are not valid as a React child(?: \\(found: ([^)]*)\\))?",
        why: "A plain object (found: $1) was placed inside JSX, where React expects text, numbers or elements. It usually happens when rendering a whole record instead of one of its fields, or a Promise or Date instead of its value.",
        fix: "Render a field of the object, or map an array of objects to elements. Convert Dates with toLocaleString(), and await promises before rendering their result.",
        before: "return <p>{user}</p>", after: "return <p>{user.name}</p>", codeLang: "jsx",
      },
    ],
    checklist: [
      "Read the component name React prints under the error.",
      "Match the message to the rule it is about (hooks, render purity, hydration, state).",
      "Look for conditional hooks, state updates in render, or browser-only values.",
      "Reproduce with React StrictMode on to surface impure render code.",
      "Run npm ls react react-dom after any dependency change.",
    ],
    faqs: [
      { q: "Why did the error start after I added a library?", a: "Libraries can bring their own copy of React or a different version of react-dom. Run npm ls react to check there is a single copy, and use a package manager override if two exist." },
      { q: "How is a hydration error different from a normal render error?", a: "A render error means a component threw. A hydration error means it rendered fine on both sides but the two outputs differed. The fix is making the first render identical, not catching an exception." },
      { q: "Does Errorless support Next.js hydration errors?", a: "Yes, the hydration pattern above applies to Next.js. In Dev Mode, choose Next.js as the framework and paste both the error and the component for a diagnosis that quotes your code." },
    ],
    related: ["javascript-error-debugger", "typescript-error-solver", "nodejs-error-fixer"],
    demoError: "Warning: Invalid hook call. Hooks can only be called inside of the body of a function component.\n    at Panel (Panel.jsx:3:25)",
    demoCode: "function Panel({ open }) {\n  if (open) {\n    const [count, setCount] = useState(0)\n  }\n  return <div />\n}\n",
    updated: U,
  },

  // ───────────────────────── Node.js ─────────────────────────
  {
    slug: "nodejs-error-fixer",
    name: "Node.js Error Fixer",
    navLabel: "Node.js",
    metaTitle: "Node.js Error Fixer: Cannot Find Module, EADDRINUSE, ESM",
    metaDescription: "Fix common Node.js errors: Cannot find module, EADDRINUSE, ENOENT, ESM vs CommonJS import errors and heap out of memory, with causes and commands.",
    debugLanguage: "javascript",
    debugFramework: "Node.js / Express",
    intro: [
      "Node errors are usually about the environment around your code rather than the code itself: a module that is not installed, a port another process holds, a file path that is relative to the wrong folder, or a project mixing two module systems.",
      "This page lists the Node.js errors developers search for most, explains what each one says about your environment, and gives the commands that fix it. Paste a terminal error to see which pattern it matches.",
    ],
    approach: [
      { title: "Check the environment first", body: "Node version, working directory, installed packages and environment variables explain many errors before any code needs changing." },
      { title: "Use the error code", body: "Codes such as EADDRINUSE, ENOENT and ERR_MODULE_NOT_FOUND are stable and precise. Search by the code, not the full sentence." },
      { title: "Run only safe commands", body: "Diagnostics like npm ls, node -v and lsof -i are read-only. Errorless suggests commands like these and never suggests destructive ones." },
    ],
    errors: [
      {
        id: "cannot-find-module", title: "Error: Cannot find module", example: "Error: Cannot find module 'express'\nRequire stack:\n- /app/server.js",
        pattern: "Cannot find module '([^']+)'",
        why: "Node could not resolve '$1'. For a package, it is not installed in this project's node_modules (or the install failed). For a relative path such as ./utils, the file name, extension or folder is wrong.",
        fix: "For a package run npm install $1 in the project folder and check it appears in package.json. For a relative path, compare the path with the real file name and casing; Linux is case sensitive.",
        before: "const db = require(\"./Database\") // file is database.js", after: "const db = require(\"./database\")", codeLang: "javascript",
      },
      {
        id: "eaddrinuse", title: "EADDRINUSE: address already in use", example: "Error: listen EADDRINUSE: address already in use :::3000",
        pattern: "EADDRINUSE[^\\n]*?:(\\d{2,5})",
        why: "Another process is already listening on port $1, often an earlier run of your own server that did not shut down, or another app that uses the same port.",
        fix: "Find the process with lsof -i :$1 (macOS/Linux) or netstat -ano | findstr :$1 (Windows), stop it, or start your server on a different port using an environment variable.",
        before: "app.listen(3000)", after: "app.listen(process.env.PORT || 3000)", codeLang: "javascript",
      },
      {
        id: "esm-cjs", title: "Cannot use import statement outside a module", example: "SyntaxError: Cannot use import statement outside a module",
        pattern: "Cannot use import statement outside a module|require is not defined in ES module scope|ERR_REQUIRE_ESM|ERR_MODULE_NOT_FOUND",
        why: "The file uses one module system while Node is running it as the other. import/export needs ES modules; require needs CommonJS. Node decides from the file extension and the \"type\" field in package.json.",
        fix: "Pick one: add \"type\": \"module\" to package.json (then use import and file extensions in relative imports), or keep CommonJS and use require. A file can also opt in with the .mjs or .cjs extension.",
        before: "// package.json has no \"type\"\nimport fs from \"fs\"", after: "// package.json\n{ \"type\": \"module\" }", codeLang: "json",
      },
      {
        id: "enoent", title: "ENOENT: no such file or directory", example: "Error: ENOENT: no such file or directory, open 'config/settings.json'",
        pattern: "ENOENT: no such file or directory,? (?:open|stat|scandir|lstat)? ?'([^']+)'",
        why: "Node could not find '$1'. Relative paths are resolved from the folder where you started the process, not from the folder of the source file, so the same code works from one directory and fails from another.",
        fix: "Build the path from the file's own location with path.join(__dirname, ...), or import.meta.url in ES modules, and confirm the file exists in the deployed output.",
        before: "fs.readFileSync(\"config/settings.json\")", after: "fs.readFileSync(path.join(__dirname, \"config\", \"settings.json\"))", codeLang: "javascript",
      },
      {
        id: "heap-oom", title: "JavaScript heap out of memory", example: "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
        pattern: "heap out of memory|Reached heap limit|Allocation failed",
        why: "The process used more memory than Node's default heap limit allows. It is either a real leak (data kept in a global array or cache that never shrinks) or a job that loads a very large file or result set all at once.",
        fix: "First find what grows: take a heap snapshot or log process.memoryUsage(). Process large data as a stream or in batches. Raising the limit with --max-old-space-size only delays a leak.",
        before: "const rows = await db.query(\"SELECT * FROM events\")", after: "// read in batches with LIMIT/OFFSET or a cursor\nfor await (const row of cursor) handle(row)", codeLang: "javascript",
      },
    ],
    checklist: [
      "Run node -v and compare it with the version your project expects.",
      "Check you are in the project folder and that dependencies are installed.",
      "Search by the error code, such as ENOENT or EADDRINUSE.",
      "Use read-only commands (npm ls, lsof) before changing anything.",
      "Re-run with the same command and working directory that failed.",
    ],
    faqs: [
      { q: "Should I delete node_modules and reinstall?", a: "Only after you have checked the cause. It is a common fix for corrupted installs but it hides the reason and is not needed for ports, paths or module-system errors. Errorless does not suggest destructive commands." },
      { q: "Why does it work on my machine but not in production?", a: "Usually different Node versions, missing environment variables, different working directories or case-sensitive file systems. Compare those four before looking at code." },
      { q: "Can Errorless read my terminal output directly?", a: "No. You paste it. Secrets such as tokens and connection strings are masked before anything is sent to the AI in Dev Mode." },
    ],
    related: ["javascript-error-debugger", "api-error-troubleshooter", "docker-error-debugger"],
    demoError: "Error: Cannot find module 'express'\nRequire stack:\n- /app/server.js\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1140:15)",
    updated: U,
  },

  // ───────────────────────── SQL ─────────────────────────
  {
    slug: "sql-error-explainer",
    name: "SQL Error Explainer",
    navLabel: "SQL",
    metaTitle: "SQL Error Explainer: Missing Table, Duplicate Key, GROUP BY",
    metaDescription: "Understand PostgreSQL, MySQL and SQLite errors: relation does not exist, duplicate key, GROUP BY rules, foreign keys and syntax errors, with fixes.",
    debugLanguage: "sql",
    debugFramework: "None / plain language",
    intro: [
      "Database errors are precise but written for the database, not for you. The message names a table, a constraint or a token, and that name is the clue: it tells you exactly what the engine could not find or refused to allow.",
      "This page translates the SQL errors developers see most across PostgreSQL, MySQL and SQLite, explains which part of your query or schema each one points to, and shows the fix. Paste a database error to see which pattern it matches.",
    ],
    approach: [
      { title: "Separate query errors from data errors", body: "A syntax error or missing column is wrong in the query. A duplicate key or foreign key error is fine in the query but wrong for the data. The fix is in a different place for each." },
      { title: "Use the names in the message", body: "The table, constraint or column named in the message tells you where to look. Constraint names usually show which columns are involved." },
      { title: "Test fixes on a copy first", body: "Schema changes and bulk updates are hard to undo. Errorless never suggests destructive statements such as DROP or TRUNCATE as a fix." },
    ],
    errors: [
      {
        id: "missing-table", title: "relation or table does not exist", example: "ERROR: relation \"users\" does not exist",
        pattern: "relation \"([^\"]+)\" does not exist|Table '[^']*' doesn't exist|no such table: (\\S+)",
        why: "The database has no table called '$1$2' where the query ran. Common causes are a migration that has not run on this database, a different schema (Postgres search_path), the wrong database, or a name created with quotes and different capitalization.",
        fix: "Confirm which database you are connected to (SELECT current_database();), list tables (\\dt in psql), and run pending migrations. Use schema-qualified names, such as public.users, if the table lives in another schema.",
        before: "SELECT id FROM Users;   -- table was created as \"users\"", after: "SELECT id FROM public.users;", codeLang: "sql",
      },
      {
        id: "unique-violation", title: "duplicate key value violates unique constraint", example: "ERROR: duplicate key value violates unique constraint \"users_email_key\"",
        pattern: "duplicate key value violates unique constraint \"([^\"]+)\"|Duplicate entry '([^']*)' for key|UNIQUE constraint failed: (\\S+)",
        why: "An insert or update would create a second row with a value that must be unique (constraint $1$3). The query is valid; the data already has that value.",
        fix: "Decide what should happen for existing values: skip, update, or report it. Use INSERT ... ON CONFLICT (Postgres), INSERT IGNORE or ON DUPLICATE KEY UPDATE (MySQL), or check first.",
        before: "INSERT INTO users (email) VALUES ('a@x.dev');", after: "INSERT INTO users (email) VALUES ('a@x.dev')\nON CONFLICT (email) DO NOTHING;", codeLang: "sql",
      },
      {
        id: "group-by", title: "column must appear in the GROUP BY clause", example: "ERROR: column \"orders.customer_name\" must appear in the GROUP BY clause or be used in an aggregate function",
        pattern: "column \"([^\"]+)\" must appear in the GROUP BY clause|ONLY_FULL_GROUP_BY|not contained in either an aggregate function or the GROUP BY clause",
        why: "The query groups rows, but selects a column ($1) that is neither grouped nor aggregated, so the database cannot know which row's value to show.",
        fix: "Add the column to GROUP BY if you want one row per value, or wrap it in an aggregate such as MAX() or COUNT() if you want a summary.",
        before: "SELECT customer_id, customer_name, SUM(total)\nFROM orders GROUP BY customer_id;", after: "SELECT customer_id, customer_name, SUM(total)\nFROM orders GROUP BY customer_id, customer_name;", codeLang: "sql",
      },
      {
        id: "foreign-key", title: "violates foreign key constraint", example: "ERROR: insert or update on table \"orders\" violates foreign key constraint \"orders_customer_id_fkey\"",
        pattern: "violates foreign key constraint(?: \"([^\"]+)\")?|a foreign key constraint fails|FOREIGN KEY constraint failed",
        why: "A row refers to another row that does not exist (insert/update), or you are deleting a row that other rows still refer to. The constraint ($1) is protecting data integrity.",
        fix: "On insert, create the referenced row first. On delete, remove or reassign the dependent rows first, or define ON DELETE CASCADE only if deleting children is really the intended behavior.",
        before: "INSERT INTO orders (customer_id) VALUES (99);", after: "-- ensure customer 99 exists first\nINSERT INTO customers (id) VALUES (99);\nINSERT INTO orders (customer_id) VALUES (99);", codeLang: "sql",
      },
      {
        id: "syntax", title: "syntax error at or near", example: "ERROR: syntax error at or near \"FROM\"",
        pattern: "syntax error at or near \"?([^\"\\n]+)\"?|You have an error in your SQL syntax|Incorrect syntax near",
        why: "The parser stopped at '$1'. The real mistake is usually just before it: a trailing comma in the select list, a missing keyword, an unquoted reserved word used as a name, or a missing comma between items.",
        fix: "Look at the token before the one named and check commas, parentheses and quotes. Quote reserved words used as column names, and format the query one clause per line so the gap is visible.",
        before: "SELECT id, name, FROM users;", after: "SELECT id, name FROM users;", codeLang: "sql",
      },
    ],
    checklist: [
      "Note which table, constraint or column the message names.",
      "Decide whether the query or the data is wrong.",
      "Check you are connected to the database and schema you expect.",
      "Run the fix on a copy or inside a transaction you can roll back.",
      "Re-run the original statement to confirm the error is gone.",
    ],
    faqs: [
      { q: "Does this work for PostgreSQL, MySQL and SQLite?", a: "The explainer recognises the wording of all three for the errors listed. Syntax details such as upsert statements differ by engine, and each fix notes which engine it applies to." },
      { q: "Will Errorless run my SQL?", a: "No. It never connects to your database or executes queries. Paste the error and the statement; the explainer runs in your browser, and Dev Mode analysis only reasons about the text you submit." },
      { q: "Is it safe to paste a connection string?", a: "Avoid it if you can. If you do, passwords and tokens in connection strings are masked before Dev Mode sends anything to the AI, but rotating a credential you pasted anywhere is a good habit." },
    ],
    related: ["api-error-troubleshooter", "python-error-fixer", "nodejs-error-fixer"],
    demoError: "ERROR:  relation \"users\" does not exist\nLINE 1: SELECT id, email FROM users WHERE active = true;",
    updated: U,
  },

  // ───────────────────────── API ─────────────────────────
  {
    slug: "api-error-troubleshooter",
    name: "API Error Troubleshooter",
    navLabel: "API",
    metaTitle: "API Error Troubleshooter: 401, 404, 429, CORS and 5xx",
    metaDescription: "Troubleshoot API errors: 401 Unauthorized, CORS blocks, 404, 429 rate limits, 5xx server errors and ECONNREFUSED, with what each means and how to fix it.",
    debugLanguage: "javascript",
    debugFramework: "None / plain language",
    intro: [
      "An API error has two possible owners: the request you sent, or the server that answered. The status code tells you which. 4xx means the request was rejected for something you can change; 5xx means the server failed; no status at all (CORS, ECONNREFUSED) means the request never completed.",
      "This page walks through the API errors developers troubleshoot most, shows who owns each one, and gives the check that confirms the cause. Paste an API error to see which pattern it matches.",
    ],
    approach: [
      { title: "Decide who owns the failure", body: "A 4xx status points to your request: credentials, URL, body or rate. A 5xx points to the server. A network error with no status points to connectivity or browser policy." },
      { title: "Reproduce outside the browser", body: "A curl request with the same URL, headers and body removes the browser from the picture and shows the raw response, which is the most direct evidence available." },
      { title: "Read the response body", body: "Most APIs explain the rejection in the JSON body. The status is the category; the body is the reason." },
    ],
    errors: [
      {
        id: "cors", title: "Blocked by CORS policy", example: "Access to fetch at 'https://api.example.com' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.",
        pattern: "blocked by CORS policy|Access-Control-Allow-Origin|CORS error|CORS header",
        why: "The browser, not your code, refused to expose the response because the server did not say your origin is allowed. The request may even have succeeded on the server. Server-to-server calls and curl are not affected.",
        fix: "Fix it on the server: return Access-Control-Allow-Origin for your origin and handle the OPTIONS preflight with the allowed methods and headers. In development you can proxy the API through your dev server instead.",
        before: "// server sends no CORS headers", after: "res.setHeader(\"Access-Control-Allow-Origin\", \"https://app.example.com\")\nres.setHeader(\"Access-Control-Allow-Headers\", \"Content-Type, Authorization\")", codeLang: "javascript",
      },
      {
        id: "unauthorized", title: "401 Unauthorized (and 403 Forbidden)", example: "AxiosError: Request failed with status code 401",
        pattern: "\\b40[13]\\b|Unauthorized|Forbidden|invalid[_ ]token|token (?:has )?expired",
        why: "401 means the server does not accept your credentials: missing, malformed or expired token, or the wrong header format. 403 means the credentials are valid but this account is not allowed to do this.",
        fix: "Check the Authorization header is present and correctly formatted (Bearer <token>), the token has not expired, and you are using the right environment's key. For 403, check roles and scopes.",
        before: "headers: { Authorization: token }", after: "headers: { Authorization: `Bearer ${token}` }", codeLang: "javascript",
      },
      {
        id: "not-found", title: "404 Not Found", example: "GET https://api.example.com/v1/user/42 404 (Not Found)",
        pattern: "\\b404\\b|Not Found",
        why: "The server has no route at that URL, or no resource with that id. Frequent causes are a wrong base URL or version prefix, a missing or extra slash, a wrong HTTP method, or an id that does not exist.",
        fix: "Compare the URL character by character with the API documentation, including the version prefix and plural or singular resource names, then check the id exists.",
        before: "fetch(`${API}/user/${id}`)   // docs: /users/{id}", after: "fetch(`${API}/users/${id}`)", codeLang: "javascript",
      },
      {
        id: "rate-limit", title: "429 Too Many Requests", example: "HTTP/1.1 429 Too Many Requests\nRetry-After: 30",
        pattern: "\\b429\\b|Too Many Requests|rate limit",
        why: "You have sent more requests than the API allows in a time window. A loop without delay, retries on failure, or several clients sharing one key are typical causes.",
        fix: "Respect the Retry-After header, add exponential backoff with a retry cap, cache repeated responses, and batch requests where the API supports it.",
        before: "for (const id of ids) await call(id)   // fires as fast as possible", after: "// retry politely when rate limited\nif (res.status === 429) await sleep(Number(res.headers.get(\"retry-after\") ?? 1) * 1000)", codeLang: "javascript",
      },
      {
        id: "server-error", title: "500, 502, 503 and 504 server errors", example: "HTTP/1.1 502 Bad Gateway",
        pattern: "\\b50[0234]\\b|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out",
        why: "The server or a proxy in front of it failed. 500 is an unhandled error in the application, 502 and 504 mean a gateway got a bad answer or none from the upstream service, and 503 means the service is overloaded or down.",
        fix: "These are usually not fixable from the client. Capture the request id and timestamp, check the provider's status page, and look at server logs. Retry idempotent requests with backoff.",
        before: "// retry forever on 500", after: "// retry GET requests a few times with backoff, then surface the error", codeLang: "javascript",
      },
      {
        id: "econnrefused", title: "ECONNREFUSED: connection refused", example: "Error: connect ECONNREFUSED 127.0.0.1:5000",
        pattern: "ECONNREFUSED(?:[^\\n]*?([\\d.:]+:\\d+))?|connection refused",
        why: "Nothing is listening at $1. The server is not running, is listening on a different port, or the address is wrong for where your code runs; localhost inside a container is not the host machine.",
        fix: "Start the service, confirm its port, and use the right host name. In Docker Compose, use the service name instead of localhost.",
        before: "const API = \"http://localhost:5000\"   // inside a container", after: "const API = process.env.API_URL // e.g. http://api:5000 in Compose", codeLang: "javascript",
      },
    ],
    checklist: [
      "Note the status code, or that there was none.",
      "Repeat the request with curl -i and the same headers.",
      "Read the response body, not just the status.",
      "Check the URL, method, credentials and environment.",
      "For 5xx, collect the request id and time and check server logs.",
    ],
    faqs: [
      { q: "Why does my API work in Postman but fail in the browser?", a: "Postman does not enforce CORS and browsers do. If the same request works in curl or Postman, the server needs to send CORS headers for your origin." },
      { q: "Is a 403 the same as a 401?", a: "No. 401 means the server does not know who you are. 403 means it knows and refuses. The fix for 401 is credentials; for 403 it is permissions." },
      { q: "Does Errorless send requests to my API?", a: "No. It never calls your endpoints. It explains the error text you paste, and Dev Mode suggests curl commands for you to run yourself." },
    ],
    related: ["javascript-error-debugger", "nodejs-error-fixer", "docker-error-debugger"],
    demoError: "Access to fetch at 'https://api.example.com/v1/me' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
    updated: U,
  },

  // ───────────────────────── Docker ─────────────────────────
  {
    slug: "docker-error-debugger",
    name: "Docker Error Debugger",
    navLabel: "Docker",
    metaTitle: "Docker Error Debugger: Daemon, Port, COPY and Exit 137",
    metaDescription: "Fix Docker errors: cannot connect to the daemon, port already allocated, COPY file not found, exec format error, pull access denied and exit code 137.",
    debugLanguage: "dockerfile",
    debugFramework: "Docker / Compose",
    intro: [
      "Docker errors fall into three groups: the daemon is not reachable, the image fails to build, or the container starts and then dies. Telling the groups apart tells you where to look: your Docker installation, your Dockerfile, or your application and its resources.",
      "This page explains the Docker errors developers search for most, which group each belongs to, and the commands that confirm and fix them. Paste a build or run error to see which pattern it matches.",
    ],
    approach: [
      { title: "Locate the failure stage", body: "Daemon errors happen before anything runs, build errors name a Dockerfile step, and run errors come with an exit code. The stage narrows the cause immediately." },
      { title: "Read the failing step, not the last line", body: "Build output ends with a generic message. The useful line is the step that failed, for example the COPY or RUN instruction just above it." },
      { title: "Prefer inspection to cleanup", body: "docker ps, docker logs and docker inspect are read-only. Errorless does not suggest docker system prune or other destructive cleanups as a first fix." },
    ],
    errors: [
      {
        id: "daemon", title: "Cannot connect to the Docker daemon", example: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
        pattern: "Cannot connect to the Docker daemon|docker daemon is not running|error during connect",
        why: "The docker command cannot reach the Docker engine. The engine (Docker Desktop or the dockerd service) is not running, or your user does not have permission to use the socket.",
        fix: "Start Docker Desktop or the service (sudo systemctl start docker on Linux). On Linux, add your user to the docker group and log in again. Check with docker info.",
        before: "docker ps   # daemon not running", after: "sudo systemctl start docker\ndocker info", codeLang: "bash",
      },
      {
        id: "port-allocated", title: "Bind for port failed: port is already allocated", example: "Bind for 0.0.0.0:5432 failed: port is already allocated",
        pattern: "Bind for [\\d.:]*:(\\d+) failed: port is already allocated|address already in use|port is already allocated",
        why: "Port $1 on your machine is already used, by another container or by a program outside Docker such as a local database. A stopped-but-existing container does not hold ports, a running one does.",
        fix: "See what holds it with docker ps and lsof -i :$1, then stop it or map a different host port, for example 5433:5432 (host:container).",
        before: "ports:\n  - \"5432:5432\"", after: "ports:\n  - \"5433:5432\"", codeLang: "yaml",
      },
      {
        id: "copy-not-found", title: "COPY failed: file not found in build context", example: "failed to compute cache key: \"/package-lock.json\" not found",
        pattern: "COPY failed|failed to compute cache key[^\\n]*\"/?([^\"]+)\"[^\\n]*not found|not found in build context",
        why: "The file '$1' is not inside the build context, which is the folder you pass to docker build, or it is excluded by .dockerignore. Paths in COPY are relative to the context, not to the Dockerfile.",
        fix: "Check the file exists in the context folder, that .dockerignore does not list it, and that you ran docker build from the right directory with the right context argument.",
        before: "COPY package.json ./\nRUN npm ci", after: "COPY package.json package-lock.json ./\nRUN npm ci", codeLang: "dockerfile",
      },
      {
        id: "exec-format", title: "exec format error", example: "exec /usr/local/bin/docker-entrypoint.sh: exec format error",
        pattern: "exec format error|no matching manifest for [\\w/]+|exec [^\\n]*: no such file or directory",
        why: "The binary or script cannot run in this container. Either the image was built for a different CPU architecture (arm64 vs amd64), or a shell script has Windows line endings or a missing shebang, which also surfaces as 'no such file or directory'.",
        fix: "Build or pull the image for the right platform (--platform linux/amd64), and make sure scripts use LF line endings and start with #!/bin/sh or #!/usr/bin/env bash.",
        before: "docker run myimage   # built on Apple silicon, run on amd64", after: "docker build --platform linux/amd64 -t myimage .", codeLang: "bash",
      },
      {
        id: "pull-denied", title: "pull access denied or manifest unknown", example: "pull access denied for myapp, repository does not exist or may require 'docker login'",
        pattern: "pull access denied for ([^,\\s]+)|manifest unknown|repository does not exist|manifest for [^\\s]+ not found",
        why: "Docker could not fetch '$1'. The image name or tag is misspelled, the tag does not exist, or the image is private and you are not logged in. A local image that was never built also looks like this.",
        fix: "Check the name and tag exactly, run docker login for private registries, and build local images before using them in Compose.",
        before: "image: nodee:20", after: "image: node:20", codeLang: "yaml",
      },
      {
        id: "exit-137", title: "Container exited with code 137", example: "myapp exited with code 137",
        pattern: "exited with code 137|exit code 137|OOMKilled|Killed",
        why: "137 means the process was killed with SIGKILL, most often because the container ran out of memory and the kernel's OOM killer stopped it, or because it was stopped forcefully.",
        fix: "Confirm with docker inspect <container> --format '{{.State.OOMKilled}}'. Then reduce the app's memory use, raise the container or Docker Desktop memory limit, or fix the leak.",
        before: "deploy:\n  resources:\n    limits:\n      memory: 128M", after: "deploy:\n  resources:\n    limits:\n      memory: 512M", codeLang: "yaml",
      },
    ],
    checklist: [
      "Decide the stage: daemon, build or run.",
      "For build errors, find the failing Dockerfile step above the final message.",
      "For run errors, read the exit code and run docker logs <container>.",
      "Use read-only commands (docker ps, logs, inspect) before changing anything.",
      "Rebuild with --no-cache only if a cached layer is the suspect.",
    ],
    faqs: [
      { q: "Why does my build work locally but fail in CI?", a: "Common reasons are files excluded by .dockerignore or never committed, a different build context directory, and a different CPU architecture. Compare the context and the platform first." },
      { q: "Should I run docker system prune?", a: "Not as a first step. It deletes stopped containers and unused images, which can remove things you need. Inspect with docker ps -a and docker logs first." },
      { q: "Can Errorless read my Dockerfile?", a: "Yes, in Dev Mode you can paste or upload it and the analysis quotes the lines it relies on. Secrets in ENV and ARG lines are masked before anything is sent." },
    ],
    related: ["nodejs-error-fixer", "api-error-troubleshooter", "python-error-fixer"],
    demoError: "failed to solve: process \"/bin/sh -c npm ci\" did not complete successfully: exit code: 1\nfailed to compute cache key: \"/package-lock.json\" not found",
    demoCode: "FROM node:20-alpine\nWORKDIR /app\nCOPY package.json ./\nRUN npm ci\nCOPY . .\nCMD [\"node\", \"server.js\"]\n",
    updated: U,
  },
]

export const TOOL_SLUGS = TOOL_PAGES.map((t) => t.slug)

export function getTool(slug: string): ToolPage | undefined {
  return TOOL_PAGES.find((t) => t.slug === slug)
}

export function toolPath(slug: string): string {
  return `/tools/${slug}`
}
