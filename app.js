// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const Error = Symbol("Error");
const Queue = new Set();
let nodeQueue;
let parentNode;
function root(callback) {
    const _node = node();
    parentNode = _node;
    try {
        return batch(()=>{
            let _cleanup = undefined;
            if (callback.length) {
                _cleanup = cleanNode.bind(undefined, _node, true);
            }
            return callback(_cleanup);
        });
    } catch (error) {
        handleError(error);
    } finally{
        parentNode = _node.parentNode;
    }
}
function node(initialValue, callback) {
    const _node = {
        value: initialValue,
        parentNode,
        children: undefined,
        context: undefined,
        cleanups: undefined,
        callback,
        sources: undefined,
        sourceSlots: undefined
    };
    if (parentNode) {
        if (parentNode.children === undefined) {
            parentNode.children = [
                _node
            ];
        } else {
            parentNode.children.push(_node);
        }
    }
    return _node;
}
function mount(callback) {
    effect(()=>untrack(callback));
}
function effect(callback, initialValue) {
    if (parentNode) {
        const _node = node(initialValue, callback);
        if (nodeQueue) nodeQueue.add(_node);
        else queueMicrotask(()=>updateNode(_node, false));
    } else {
        queueMicrotask(()=>callback(initialValue));
    }
}
function lookup(node, id) {
    return node ? node.context && id in node.context ? node.context[id] : lookup(node.parentNode, id) : undefined;
}
function source(initialValue) {
    return {
        value: initialValue,
        nodes: undefined,
        nodeSlots: undefined
    };
}
function sourceValue(source, next) {
    if (arguments.length === 1) {
        if (parentNode && parentNode.callback) {
            const sourceSlot = source.nodes?.length || 0, nodeSlot = parentNode.sources?.length || 0;
            if (parentNode.sources === undefined) {
                parentNode.sources = [
                    source
                ];
                parentNode.sourceSlots = [
                    sourceSlot
                ];
            } else {
                parentNode.sources.push(source);
                parentNode.sourceSlots.push(sourceSlot);
            }
            if (source.nodes === undefined) {
                source.nodes = [
                    parentNode
                ];
                source.nodeSlots = [
                    nodeSlot
                ];
            } else {
                source.nodes.push(parentNode);
                source.nodeSlots.push(nodeSlot);
            }
        }
        return source.value;
    }
    if (typeof next === "function") {
        next = next(source.value);
    }
    source.value = next;
    if (source.nodes?.length) {
        batch(()=>{
            for (const node of source.nodes){
                nodeQueue.add(node);
            }
        });
    }
}
function signal(initialValue) {
    const _source = source(initialValue);
    return sourceValue.bind(undefined, _source);
}
function handleError(error) {
    const errorCallbacks = lookup(parentNode, Error);
    if (!errorCallbacks) return reportError(error);
    for (const callback of errorCallbacks){
        callback(error);
    }
}
function cleanup(callback) {
    if (parentNode === undefined) return;
    else if (!parentNode.cleanups) parentNode.cleanups = [
        callback
    ];
    else parentNode.cleanups.push(callback);
}
function untrack(callback) {
    const node = parentNode;
    parentNode = undefined;
    const result = callback();
    parentNode = node;
    return result;
}
function batch(callback) {
    if (nodeQueue) return callback();
    nodeQueue = Queue;
    const result = callback();
    queueMicrotask(flush);
    return result;
}
function flush() {
    if (nodeQueue === undefined) return;
    for (const node of nodeQueue){
        nodeQueue.delete(node);
        updateNode(node, false);
    }
    nodeQueue = undefined;
}
function updateNode(node, complete) {
    cleanNode(node, complete);
    if (node.callback === undefined) return;
    const previousNode = parentNode;
    parentNode = node;
    try {
        node.value = node.callback(node.value);
    } catch (error) {
        handleError(error);
    } finally{
        parentNode = previousNode;
    }
}
function cleanNodeSources(node) {
    let source, sourceSlot, sourceNode, nodeSlot;
    while(node.sources.length){
        source = node.sources.pop();
        sourceSlot = node.sourceSlots.pop();
        if (source.nodes?.length) {
            sourceNode = source.nodes.pop();
            nodeSlot = source.nodeSlots.pop();
            if (sourceSlot < source.nodes.length) {
                source.nodes[sourceSlot] = sourceNode;
                source.nodeSlots[sourceSlot] = nodeSlot;
                sourceNode.sourceSlots[nodeSlot] = sourceSlot;
            }
        }
    }
}
function cleanChildNodes(node, complete) {
    const hasCallback = node.callback !== undefined;
    let childNode;
    while(node.children.length){
        childNode = node.children.pop();
        cleanNode(childNode, complete || hasCallback && childNode.callback !== undefined);
    }
}
function cleanNode(node, complete) {
    if (node.sources?.length) cleanNodeSources(node);
    if (node.children?.length) cleanChildNodes(node, complete);
    if (node.cleanups?.length) {
        while(node.cleanups.length){
            node.cleanups.pop()();
        }
    }
    node.context = undefined;
    if (complete) {
        for(const property in node){
            node[property] = undefined;
        }
    }
}
let parentFgt;
let parentElt;
function addElement(tagName, options) {
    const elt = document.createElement(tagName);
    if (options) modify(elt, options);
    if (parentElt || parentFgt) insert(elt);
}
function addText(value) {
    const node = new Text();
    if (typeof value === "function") {
        effect((current)=>{
            const next = value();
            if (next !== current) node.data = next;
            return next;
        });
    } else {
        node.data = value;
    }
    insert(node);
}
function addEvent(type, callback) {
    const elt = parentElt;
    if (elt === undefined) return;
    mount(()=>elt.addEventListener(type, callback));
    cleanup(()=>elt.removeEventListener(type, callback));
}
function setAttribute(name, value) {
    const elt = parentElt;
    if (elt === undefined) return;
    const qualifiedName = name.replace("A-Z", "-$1".toLocaleLowerCase());
    if (typeof value === "function") {
        effect(()=>elt.setAttribute(qualifiedName, value()));
    } else {
        elt.setAttribute(qualifiedName, value);
    }
}
function render(rootElt, callback) {
    return root((cleanup)=>{
        effect(()=>modify(rootElt, callback));
        return cleanup;
    });
}
function component(callback) {
    return (...args)=>root(()=>callback(...args));
}
function union(elt, next) {
    const current = Array.from(elt.childNodes);
    const currentLength = current.length;
    const nextLength = next.length;
    let currentNode, i, j;
    outerLoop: for(i = 0; i < nextLength; i++){
        currentNode = current[i];
        for(j = 0; j < currentLength; j++){
            if (current[j] === undefined) continue;
            if (current[j].nodeType === 3 && next[i].nodeType === 3) {
                if (current[j].data !== next[i].data) {
                    current[j].data = next[i].data;
                }
                next[i] = current[j];
            } else if (current[j].isEqualNode(next[i])) {
                next[i] = current[j];
            }
            if (next[i] === current[j]) {
                current[j] = undefined;
                if (i === j) continue outerLoop;
                break;
            }
        }
        elt?.insertBefore(next[i], currentNode?.nextSibling || null);
    }
    while(current.length)current.pop()?.remove();
}
function attributes(elt, current, next) {
    if (next !== undefined) {
        if (current) {
            for(const field in current){
                if (next[field] === undefined) {
                    elt[field] = null;
                }
            }
        }
        for(const field1 in next){
            if (current === undefined || current[field1] !== next[field1]) {
                elt[field1] = next[field1];
            }
        }
    }
}
function insert(node) {
    if (parentElt === undefined) parentFgt?.push(node);
    parentElt?.appendChild(node);
}
function modify(elt, options) {
    effect((current)=>{
        const next = options.length ? {} : undefined;
        const previousElt = parentElt;
        const previousFgt = parentFgt;
        const nextFgt = parentFgt = [];
        parentElt = elt;
        options(next);
        parentElt = previousElt;
        if (current || next) {
            attributes(elt, current, next);
        }
        if (nextFgt.length) {
            union(elt, nextFgt);
            parentFgt = previousFgt;
        }
        return next;
    });
}
const Button = component((text)=>{
    addElement("div", ()=>{
        addElement("button", ()=>{
            addText("klick mich");
            addEvent("click", ()=>text(prompt("new text")));
        });
    });
});
const App = component((text)=>{
    addElement("h2", ()=>{
        setAttribute("style", "color: pink");
        addText("nicer dicer evolution");
    });
    Button(text);
    addText(()=>text() === "cool" ? "sehr cool" : "");
    addElement("div", ()=>{
        setAttribute("style", "font-weight: bold");
        addText(text);
    });
    addElement("div", ()=>{
        addElement("i", (attr)=>{
            attr.textContent = "LETZTER :D";
            addText(text);
        });
    });
    addText(text);
});
render(document.body, ()=>{
    const text = signal("hello world");
    setAttribute("style", "background-color: ghostwhite");
    addElement("h1", ()=>{
        setAttribute("style", "color: cornflowerblue");
        addText("App");
    });
    App(text);
});
