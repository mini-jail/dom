// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const VALUE = 0;
const NODE_PARENT = 1;
const NODE_CHILDREN = 2;
const NODE_CONTEXT = 3;
const NODE_CLEANUPS = 4;
const NODE_CALLBACK = 5;
const NODE_SOURCES = 6;
const NODE_SOURCESLOTS = 7;
const SOURCE_NODES = 1;
const SOURCE_NODESLOTS = 2;
const Error = Symbol("Error");
const Queue = new Set();
let updateQueue;
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
        parentNode = _node[NODE_PARENT];
    }
}
function node(initialValue) {
    const _node = [
        initialValue
    ];
    if (parentNode) {
        _node[NODE_PARENT] = parentNode;
        if (parentNode[2] === undefined) {
            parentNode[NODE_CHILDREN] = [
                _node
            ];
        } else {
            parentNode[2].push(_node);
        }
    }
    return _node;
}
function computation(callback, initialValue) {
    const _node = node(initialValue);
    _node[NODE_CALLBACK] = callback;
    return _node;
}
function mount(callback) {
    effect(()=>untrack(callback));
}
function effect(callback, initialValue) {
    if (parentNode) {
        const _node = computation(callback, initialValue);
        if (updateQueue) updateQueue.add(_node);
        else queueMicrotask(()=>updateNode(_node, false));
    } else {
        queueMicrotask(()=>callback(initialValue));
    }
}
function lookup(node, id) {
    return node ? node[3] && id in node[3] ? node[3][id] : lookup(node[1], id) : undefined;
}
function source(initialValue) {
    return [
        initialValue
    ];
}
function sourceValue(source, next) {
    if (arguments.length === 1) {
        if (parentNode && parentNode[5]) {
            const sourceSlot = source[1]?.length || 0, nodeSlot = parentNode[6]?.length || 0;
            if (parentNode[6] === undefined) {
                parentNode[NODE_SOURCES] = [
                    source
                ];
                parentNode[NODE_SOURCESLOTS] = [
                    sourceSlot
                ];
            } else {
                parentNode[6].push(source);
                parentNode[7].push(sourceSlot);
            }
            if (source[1] === undefined) {
                source[SOURCE_NODES] = [
                    parentNode
                ];
                source[SOURCE_NODESLOTS] = [
                    nodeSlot
                ];
            } else {
                source[1].push(parentNode);
                source[2].push(nodeSlot);
            }
        }
        return source[0];
    }
    if (typeof next === "function") {
        next = next(source[VALUE]);
    }
    source[VALUE] = next;
    if (source[1]?.length) {
        batch(()=>{
            for (const node of source[1]){
                updateQueue.add(node);
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
    else if (!parentNode[4]) parentNode[NODE_CLEANUPS] = [
        callback
    ];
    else parentNode[4].push(callback);
}
function untrack(callback) {
    const node = parentNode;
    parentNode = undefined;
    const result = callback();
    parentNode = node;
    return result;
}
function batch(callback) {
    if (updateQueue) return callback();
    updateQueue = Queue;
    const result = callback();
    queueMicrotask(flush);
    return result;
}
function flush() {
    if (updateQueue === undefined) return;
    for (const node of updateQueue){
        updateQueue.delete(node);
        updateNode(node, false);
    }
    updateQueue = undefined;
}
function updateNode(node, complete) {
    cleanNode(node, complete);
    if (node[5] === undefined) return;
    const previousNode = parentNode;
    parentNode = node;
    try {
        node[VALUE] = node[NODE_CALLBACK](node[0]);
    } catch (error) {
        handleError(error);
    } finally{
        parentNode = previousNode;
    }
}
function cleanNodeSources(node) {
    let source, sourceSlot, sourceNode, nodeSlot;
    while(node[6].length){
        source = node[NODE_SOURCES].pop();
        sourceSlot = node[NODE_SOURCESLOTS].pop();
        if (source[1]?.length) {
            sourceNode = source[SOURCE_NODES].pop();
            nodeSlot = source[SOURCE_NODESLOTS].pop();
            if (sourceSlot < source[1].length) {
                source[SOURCE_NODES][sourceSlot] = sourceNode;
                source[SOURCE_NODESLOTS][sourceSlot] = nodeSlot;
                sourceNode[NODE_SOURCESLOTS][nodeSlot] = sourceSlot;
            }
        }
    }
}
function cleanChildNodes(node, complete) {
    const hasCallback = node[5] !== undefined;
    let childNode;
    while(node[2].length){
        childNode = node[NODE_CHILDREN].pop();
        cleanNode(childNode, complete || hasCallback && childNode[5] !== undefined);
    }
}
function cleanNode(node, complete) {
    if (node[6]?.length) cleanNodeSources(node);
    if (node[2]?.length) cleanChildNodes(node, complete);
    if (node[4]?.length) {
        while(node[4].length){
            node[4].pop()();
        }
    }
    delete node[3];
    if (complete) {
        delete node[0];
        delete node[1];
        delete node[2];
        delete node[4];
        delete node[5];
        delete node[6];
        delete node[7];
    }
}
function context(defaultValue) {
    return {
        id: Symbol(),
        provide (value, callback) {
            return provide(this, value, callback);
        },
        defaultValue
    };
}
function provide(context, value, callback) {
    return root(()=>{
        parentNode[NODE_CONTEXT] = {
            [context.id]: value
        };
        return callback();
    });
}
function use(context) {
    return lookup(parentNode, context.id) || context.defaultValue;
}
context.use = use;
let parentFgt;
let parentElt;
function elRef() {
    return parentElt;
}
function addElement(tagName, options) {
    const previousElt = parentElt;
    const elt = document.createElement(tagName);
    if (options) {
        effect((attributes)=>{
            const next = [];
            const current = Array.from(elt.childNodes);
            const previousFgt = parentFgt;
            parentFgt = next;
            parentElt = elt;
            options(attributes);
            for(const field in attributes){
                elt[field] = attributes[field];
            }
            let currentNode = null;
            outerLoop: for(let i = 0; i < next.length; i++){
                currentNode = current[i];
                for(let j = 0; j < current.length; j++){
                    if (current[j] === null) continue;
                    else if (current[j].nodeType === 3 && next[i].nodeType === 3) {
                        console.log("update text from %s to %s", current[j].data, next[i].data);
                        current[j].data = next[i].data;
                        next[i] = current[j];
                    } else if (current[j].isEqualNode(next[i])) {
                        console.log("same nodes");
                        next[i] = current[j];
                    }
                    if (next[i] === current[j]) {
                        current[j] = null;
                        if (i === j) continue outerLoop;
                        break;
                    }
                }
                elt?.insertBefore(next[i], currentNode?.nextSibling);
            }
            while(current.length)current.pop()?.remove();
            parentFgt = previousFgt;
            parentElt = undefined;
            return attributes;
        }, {});
    }
    if (parentFgt) parentFgt.push(elt);
    else parentElt?.appendChild(elt);
    parentElt = previousElt;
}
function addText(value) {
    const node = new Text();
    if (typeof value === "function") {
        effect((previous)=>{
            const next = value();
            console.log("previous: %s, next: %s", previous, next);
            if (next !== previous) node.data = next;
            return next;
        });
    } else {
        node.data = value;
    }
    if (parentFgt) parentFgt.push(node);
    else parentElt?.appendChild(node);
}
function addEvent(type, callback) {
    const elt = elRef();
    mount(()=>{
        console.log("listen %s", type);
        elt?.addEventListener(type, callback);
    });
    cleanup(()=>{
        console.log("unlisten %s", type);
        elt?.removeEventListener(type, callback);
    });
}
function render(rootElt, callback) {
    return root((cleanup)=>{
        const previousElt = parentElt;
        parentElt = rootElt;
        callback();
        parentElt = previousElt;
        return cleanup;
    });
}
function component(callback) {
    return (...args)=>root(()=>callback(...args));
}
const Button = component(()=>{
    const text = signal("hello world");
    addElement("button", ()=>{
        addEvent("click", ()=>text(prompt("new text")));
        if (text() === "cool") {
            addText("sehr cool");
        }
        addElement("p", ()=>{
            addText(text());
        });
        addElement("p", (attr)=>{
            attr.textContent = "LETZTER :D";
        });
    });
});
render(document.body, ()=>{
    Button();
});
