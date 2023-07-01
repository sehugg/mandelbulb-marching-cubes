import { Main } from "./main";

if (typeof importScripts === 'function') {
    // TODO: web worker
} else {
    new Main().startXR();
}
