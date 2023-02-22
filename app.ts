import { signal, SignalHandler } from "https://raw.githubusercontent.com/mini-jail/signals/main/mod.ts"
import {
  addElement,
  addEvent,
  addText,
  component,
  render,
  setAttribute,
} from "./mod.ts"

const App = component((text: SignalHandler<string>) => {
  addElement("h2", () => {
    setAttribute("style", "color: pink")
    addText("nicer dicer evolution")
  })

  addElement("button", () => {
    addText("klick mich")
    addEvent("click", () => text(prompt("new text")!))
  })

  addElement("div", () => {
    addText(() => text() === "cool" ? "sehr cool": "")
  })

  addElement("div", () => {
    addElement("b", () => addText(text()))
  })

  addElement("div", () => {
    addElement("i", (attr) => {
      attr.textContent = "LETZTER :D"
    })
  })
})

render(document.body, () => {
  const text = signal("hello world")
  setAttribute("style", "background-color: ghostwhite")
  addElement("h1", () => {
    setAttribute("style", "color: cornflowerblue")
    addText("App")
  })
  App(text)
})
