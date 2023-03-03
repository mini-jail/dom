// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const Error = Symbol();
const Queue = new Set();
let nodeQueue;
let parentNode;
function scoped(callback) {
    const node = createNode();
    parentNode = node;
    try {
        return batch(()=>{
            let _cleanup = undefined;
            if (callback.length) {
                _cleanup = cleanNode.bind(undefined, node, true);
            }
            return callback(_cleanup);
        });
    } catch (error) {
        handleError(error);
    } finally{
        parentNode = node.parentNode;
    }
}
function createNode(initialValue, callback) {
    const _node = {
        value: initialValue,
        parentNode,
        children: undefined,
        injections: undefined,
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
function effect(callback, initialValue) {
    if (parentNode) {
        const node = createNode(initialValue, callback);
        if (nodeQueue) nodeQueue.add(node);
        else queueMicrotask(()=>updateNode(node, false));
    } else {
        queueMicrotask(()=>callback(initialValue));
    }
}
function lookup(node, id) {
    return node ? node.injections && id in node.injections ? node.injections[id] : lookup(node.parentNode, id) : undefined;
}
function createSource(initialValue) {
    return {
        value: initialValue,
        nodes: undefined,
        nodeSlots: undefined
    };
}
function getSourceValue(source) {
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
function setSourceValue(source, value) {
    if (typeof value === "function") value = value(source.value);
    source.value = value;
    if (source.nodes?.length) {
        batch(()=>{
            for (const node of source.nodes){
                nodeQueue.add(node);
            }
        });
    }
}
function sourceValue(source, value) {
    return arguments.length === 1 ? getSourceValue(source) : setSourceValue(source, value);
}
function signal(initialValue) {
    const source = createSource(initialValue);
    return sourceValue.bind(undefined, source);
}
function handleError(error) {
    const errorCallbacks = lookup(parentNode, Error);
    if (!errorCallbacks) return reportError(error);
    for (const callback of errorCallbacks){
        callback(error);
    }
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
    if (node.cleanups?.length) cleanup(node);
    node.injections = undefined;
    if (complete) disposeNode(node);
}
function cleanup(node) {
    while(node.cleanups?.length){
        node.cleanups.pop()();
    }
}
function disposeNode(node) {
    node.value = undefined;
    node.parentNode = undefined;
    node.children = undefined;
    node.cleanups = undefined;
    node.callback = undefined;
    node.sources = undefined;
    node.sourceSlots = undefined;
}
let parentAtrs;
let parentFgt;
let parentElt;
function attributesRef() {
    return parentElt === undefined ? undefined : parentAtrs === undefined ? parentAtrs = Object.create(null) : undefined;
}
function addElement(tagName, callback) {
    const elt = document.createElement(tagName);
    if (callback) {
        const previousElt = parentElt;
        const previousAtrs = parentAtrs;
        let nextAtrs;
        if (callback.length) nextAtrs = parentAtrs = Object.create(null);
        parentElt = elt;
        callback(nextAtrs);
        if (parentAtrs) attributes(elt, parentAtrs);
        parentElt = previousElt;
        parentAtrs = previousAtrs;
    }
    insert(elt);
}
function addText(value) {
    insert(new Text(String(value)));
}
function render(rootElt, callback) {
    return scoped((cleanup)=>{
        const previousElt = parentElt;
        parentElt = rootElt;
        callback();
        parentElt = previousElt;
        return cleanup;
    });
}
function view(callback) {
    if (parentElt === undefined) return callback();
    const anchor = parentElt.appendChild(new Text());
    effect((current)=>{
        const nextFgt = parentFgt = [];
        callback();
        union(anchor.parentNode, anchor, current, nextFgt);
        parentFgt = undefined;
        return nextFgt.length > 0 ? nextFgt : undefined;
    });
}
function component(callback) {
    return (...args)=>scoped(()=>callback(...args));
}
function insertBefore(elt, child, anchor) {
    elt.insertBefore(child, anchor);
}
function union(elt, anchor, current, next) {
    if (current === undefined) {
        return next.forEach((node)=>insertBefore(elt, node, anchor));
    }
    const currentLength = current.length;
    const nextLength = next.length;
    let currentNode, i, j;
    outerLoop: for(i = 0; i < nextLength; i++){
        currentNode = current[i];
        for(j = 0; j < currentLength; j++){
            if (current[j] === undefined) continue;
            else if (current[j].nodeType === 3 && next[i].nodeType === 3) {
                if (current[j].data !== next[i].data) current[j].data = next[i].data;
                next[i] = current[j];
            } else if (current[j].isEqualNode(next[i])) next[i] = current[j];
            if (next[i] === current[j]) {
                current[j] = undefined;
                if (i === j) continue outerLoop;
                break;
            }
        }
        insertBefore(elt, next[i], currentNode?.nextSibling || anchor);
    }
    while(current.length)current.pop()?.remove();
}
function qualifiedName(name) {
    return name.replace(/([A-Z])/g, (match)=>"-" + match[0]).toLowerCase();
}
function eventName(name) {
    return name.startsWith("on:") ? name.slice(3) : name.slice(2).toLowerCase();
}
function objectAttribute(elt, field, object) {
    for(const subField in object){
        const value = object[subField];
        if (value === "function") {
            effect((subCurr)=>{
                const subNext = value();
                if (subNext !== subCurr) elt[field][subField] = subNext || null;
                return subNext;
            });
        } else {
            elt[field][subField] = value || null;
        }
    }
}
function dynamicAttribute(elt, field, value) {
    effect((current)=>{
        const next = value();
        if (next !== current) attribute(elt, field, next);
        return next;
    });
}
function attribute(elt, field, value) {
    if (typeof value === "function" && !field.startsWith("on")) {
        dynamicAttribute(elt, field, value);
    } else if (typeof value === "object") {
        objectAttribute(elt, field, value);
    } else if (field === "textContent") {
        if (elt.firstChild?.nodeType === 3) elt.firstChild.data = String(value);
        else elt.prepend(String(value));
    } else if (field in elt) {
        elt[field] = value;
    } else if (field.startsWith("on")) {
        elt.addEventListener(eventName(field), value);
    } else if (value != null) {
        elt.setAttributeNS(null, qualifiedName(field), String(value));
    } else {
        elt.removeAttributeNS(null, qualifiedName(field));
    }
}
function insert(node) {
    if (parentElt === undefined) parentFgt?.push(node);
    else parentElt?.appendChild(node);
}
function attributes(elt, value) {
    for(const field in value){
        attribute(elt, field, value[field]);
    }
}
const Button = component((init)=>{
    const counter = signal(init);
    view(()=>{
        addElement("div", ()=>{
            const attr = attributesRef();
            attr.id = "counter";
            attr.onClick = ()=>counter(counter() + 1);
            addText(`Button: ${counter()}`);
        });
        addElement("div", ()=>{
            addText("Sex");
        });
    });
});
render(document.body, ()=>{
    Button(100);
});
