import * as BABYLON from "@babylonjs/core";
import { Chunk, WorldShape } from "./chunk";

// https://www.kevs3d.co.uk/dev/shaders/
// can we make a surface shader with a few iterations?

const maxDistance = 0.1;
const minDistance = 0.01;


export class Octant {
    static shadowGenerator : BABYLON.CascadedShadowGenerator | null = null;

    level: number;
    children: Octant[] = [];
    x: number;
    y: number;
    z: number;
    chunk: Chunk;
    mesh: BABYLON.Mesh | null = null;
    childGroup: BABYLON.Mesh | null = null;
    lights: BABYLON.Light[] = [];

    constructor(
        readonly world: WorldShape,
        readonly parent: Octant | null,
        readonly index: number,
        readonly radius: number)
    {
        const r = radius;
        if (parent) {
            this.x = parent.x + ((index & 1) ? r : -r);
            this.y = parent.y + ((index & 2) ? r : -r);
            this.z = parent.z + ((index & 4) ? r : -r);
            this.level = parent.level + 1;
        } else {
            this.x = this.y = this.z = this.level = 0;
        }
        let chunkWidth = radius * 2;
        let resolution = chunkWidth / 16;
        this.chunk = new Chunk(this.x-radius, this.y-radius, this.z-radius, resolution, chunkWidth, world);
    }
    async build(scene: BABYLON.Scene) {
        console.log("building octant at " + this.x + " " + this.y + " " + this.z);
        this.chunk.create();
        let mesh = this.mesh = this.chunk.buildMesh(scene);
        if (!mesh) {
            return false;
        }
        // TODO? this.addLights(mesh);
        console.log("built octant at " + this.x + " " + this.y + " " + this.z);
        if (Octant.shadowGenerator) {
            if (this.level <= 3) {
                Octant.shadowGenerator.addShadowCaster(mesh);
            }
            mesh.receiveShadows = true;
        }
        mesh.occlusionType = BABYLON.AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
        let mesh2 = mesh.clone(mesh.name + ' clone'); // for LOD detection
        let subdivided = false;
        mesh.useLODScreenCoverage = true;
        mesh.addLODLevel(maxDistance, mesh2);
        mesh.onLODLevelSelection = (distance, _mesh, level) => {
            if (!subdivided && level == mesh) {
                subdivided = true;
                console.log("mesh LOD level selected", distance, level == this.mesh);
                if (distance == Infinity) return;
                this.subdivide(scene);
            } else if (subdivided && level != mesh && distance < minDistance) {
                subdivided = false;
                console.log("subdivided mesh LOD level selected", distance, level == this.mesh);
                this.undivide(scene);
            }
        }
        return true;
    }
    addLights(mesh: BABYLON.Mesh) {
        for (let light of this.lights) {
            light.includedOnlyMeshes.push(mesh);
        }
        if (this.parent) {
            this.parent.addLights(mesh);
        }
    }
    async placeLight(scene: BABYLON.Scene) {
        // place a visible light
        var r = Math.random();
        var g = Math.random();
        var b = 1 - r;
        let light = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(this.x, this.y, this.z), scene);
        this.parent?.lights.push(light);
        light.diffuse = new BABYLON.Color3(r, g, b);
        light.range = 100 / this.level;
        light.falloffType = BABYLON.Light.FALLOFF_GLTF;
        // place a sphere
        let sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 1}, scene);
        sphere.position = new BABYLON.Vector3(this.x, this.y, this.z);
        let mat = new BABYLON.StandardMaterial("sphereMat", scene);
        mat.emissiveColor = new BABYLON.Color3(r, g, b);
        sphere.material = mat;
    }
    createChildGroup(scene: BABYLON.Scene) {
        if (this.mesh && this.childGroup == null) {
            // create empty mesh to hold children
            this.childGroup = new BABYLON.Mesh("childGroup", scene);
            this.childGroup.useLODScreenCoverage = true;
            this.childGroup.addLODLevel(0.1, this.mesh);
            this.childGroup.onLODLevelSelection = (distance, mesh, level) => {
                //console.log("child LOD level selected", distance, mesh == this.mesh);
            }
        }
        return this.childGroup;
    }
    async createChild(scene: BABYLON.Scene, index: number) {
        let child = new Octant(this.world, this, index, this.radius / 2);
        this.children[index] = child;
        return await child.build(scene);
    }
    async subdivide(scene: BABYLON.Scene) {
        if (this.children.length == 0) {
            console.log("subdividing octant at " + this.x + " " + this.y + " " + this.z);
            let empty = [];
            for (let i=0; i<8; i++) {
                let success = await this.createChild(scene, i);
                if (!success) empty.push(this.children[i]);
            }
            console.log("empty children: " + empty.length);
            if (empty.length == 1) {
                await empty[0].placeLight(scene);
            }
        } else {
            // show children 
            for (let child of this.children) {
                if (child.mesh) {
                    child.mesh.setEnabled(true);
                }
            }
        }
        // set this.mesh invisible
        if (this.mesh) {
            //this.mesh.setEnabled(false);
            this.mesh.visibility = 0;
        }
    }
    async undivide(scene: BABYLON.Scene) {
        // hide all children
        for (let child of this.children) {
            if (child.mesh) {
                child.mesh.setEnabled(false);
            }
        }
        if (this.mesh) {
            this.mesh.visibility = 1;
        }
    }
}
