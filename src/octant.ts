import * as BABYLON from "@babylonjs/core";
import { Chunk, WorldShape } from "./chunk";
import { MandelbulbPluginMaterial } from "./shader";

// https://www.kevs3d.co.uk/dev/shaders/
// can we make a surface shader with a few iterations?
// https://www.boristhebrave.com/2018/04/15/dual-contouring-tutorial/
// https://github.com/Domenicobrz/Dual-Contouring-javascript-implementation


const gridPointsPerEdge = 12;
const maxDistance = 0.2;
const minDistance = 0.1;
const maxLevel = 6;
const overlap = 0.125;

const landingLevel = 6;
const minLandingVerts = 50;
const maxLandingVariance = 0.2;
const maxLandingAngle = 0.2;
const lightSurfaceDistance = 10;

export class Octant {
    static shadowGenerator : BABYLON.CascadedShadowGenerator | null = null;
    static material : BABYLON.StandardMaterial | null = null;

    level: number;
    children: Octant[] = [];
    subdivided = false;
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
        const r2 = r * (1 + overlap);
        if (parent) {
            this.x = parent.x + ((index & 1) ? r : -r);
            this.y = parent.y + ((index & 2) ? r : -r);
            this.z = parent.z + ((index & 4) ? r : -r);
            this.level = parent.level + 1;
        } else {
            this.x = this.y = this.z = this.level = 0;
        }
        let chunkWidth = r2 * 2;
        let resolution = chunkWidth / gridPointsPerEdge;
        this.chunk = new Chunk(this.x-r2, this.y-r2, this.z-r2, resolution, chunkWidth, world);
    }
    async build(scene: BABYLON.Scene) {
        console.log("building octant at " + this.level + " " + this.x + " " + this.y + " " + this.z);
        if (this.level == 0) {
            BABYLON.RenderingManager.MAX_RENDERINGGROUPS = maxLevel + 1;
            for (let i=0; i<maxLevel+1; i++) {
                scene.setRenderingAutoClearDepthStencil(i, false);
            }
        }
        this.chunk.create();
        let mesh = this.mesh = this.chunk.buildMesh(scene);
        if (!mesh) {
            return false;
        }
        if (Octant.material == null) {
            let mat = new BABYLON.StandardMaterial("mat", scene);
            mat.backFaceCulling = true;
            Octant.material = mat;
            new MandelbulbPluginMaterial(mat);
            let once = false;
            mat.onBind = () => {
                if (once) return;
                once = true;
                console.log(BABYLON.ShaderStore);
            }
        }
        mesh.material = Octant.material;
        // TODO? this.addLights(mesh);
        console.log("built octant at " + this.level + " " + this.x + " " + this.y + " " + this.z);
        if (Octant.shadowGenerator) {
            Octant.shadowGenerator.addShadowCaster(mesh);
            mesh.receiveShadows = true;
        }
        //mesh.isOccluded = true;
        mesh.occlusionType = BABYLON.AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
        //mesh.renderingGroupId = maxLevel + 1 - this.level;
        if (this.level < maxLevel) {
            this.setupLODDetection(scene, mesh);
        }
        if (this.level == landingLevel && this.chunk.vertices.length > minLandingVerts) {
            let meta = this.chunk.computeNormalMeanStddev();
            if (meta.varmag < maxLandingVariance && meta.angle < maxLandingAngle) {
                await this.placeLight(scene, meta.meanpos);
            }
        }
        return true;
    }
    setupLODDetection(scene: BABYLON.Scene, mesh: BABYLON.Mesh) {
        let mesh2 = mesh.clone(mesh.name + ' clone'); // for LOD detection
        let subdiv = false;
        mesh.useLODScreenCoverage = true;
        mesh.addLODLevel(maxDistance, mesh2);
        mesh.onLODLevelSelection = (distance, _mesh, level) => {
            if (!subdiv && level == mesh) {
                subdiv = true;
                console.log("mesh LOD level selected", distance, level == this.mesh);
                if (distance == Infinity) return;
                this.subdivide(scene);
            } else if (subdiv && level != mesh && distance < minDistance) {
                subdiv = false;
                console.log("subdivided mesh LOD level selected", distance, level == this.mesh);
                this.undivide(scene);
            }
        }
    }
    addLights(mesh: BABYLON.Mesh) {
        for (let light of this.lights) {
            light.includedOnlyMeshes.push(mesh);
        }
        if (this.parent) {
            this.parent.addLights(mesh);
        }
    }
    async placeLight(scene: BABYLON.Scene, cenpos: BABYLON.Vector3) {
        // get light color
        var r = Math.random();
        var g = Math.random();
        var b = 1 - r;
        let mat = new BABYLON.StandardMaterial("sphereMat", scene);
        mat.emissiveColor = new BABYLON.Color3(r, g, b);

        // get offset 
        let poffset = new BABYLON.Vector3(this.x, this.y, this.z).normalize();
        cenpos.addInPlace(poffset.scale(lightSurfaceDistance));
        // place a visible light
        let light = new BABYLON.PointLight("pointLight", cenpos, scene);
        this.parent?.lights.push(light);
        light.diffuse = new BABYLON.Color3(r, g, b);
        light.range = lightSurfaceDistance * 1.5;
        light.falloffType = BABYLON.Light.FALLOFF_GLTF;
        // place a sphere
        let sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 1}, scene);
        sphere.position = cenpos;
        sphere.material = mat;
        // create tiny points on each vertex of the chunk
        if (this.mesh) {
            poffset.scaleInPlace(0.1);
            let positions = this.chunk.vertices;
            for (let i=0; i<positions.length; i+=3*6) {
                let point = BABYLON.MeshBuilder.CreateBox("point", {size: 0.1}, scene);
                point.position = new BABYLON.Vector3(positions[i], positions[i+1], positions[i+2]).add(this.mesh.position).add(poffset);
                point.material = mat;
            }
        }
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
        if (this.subdivided) return;
        this.subdivided = true;
        if (this.children.length == 0) {
            console.log("subdividing octant at " + this.x + " " + this.y + " " + this.z);
            let empty = [];
            for (let i=0; i<8; i++) {
                let success = await this.createChild(scene, i);
                if (!success) empty.push(this.children[i]);
            }
            console.log("empty children: " + empty.length);
            if (empty.length == 1) {
                //await empty[0].placeLight(scene);
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
        if (!this.subdivided) return;
        this.subdivided = false;
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
