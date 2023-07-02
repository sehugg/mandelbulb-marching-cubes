

import { Inspector } from '@babylonjs/inspector';
import * as BABYLON from "@babylonjs/core";
// import STL loader
import "@babylonjs/loaders";
import { Chunk } from "./chunk";
import { Mandelbulb } from "./mandel";
import { Octant } from "./octant";

var debug = false;

var timeStep = 1 / 60; //TODO?

const wallWidth = 8;
const wallHeight = 6;
const hallWidth = 10;



export class Main {
    scene: BABYLON.Scene;
    xr: BABYLON.WebXRDefaultExperience | null = null;
    //ground;

    constructor() {
        const canvas = document.getElementById("maincanvas") as HTMLCanvasElement; // Get the canvas element
        const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
        const scene = this.scene = new BABYLON.Scene(engine);

        // Register a render loop to repeatedly render the scene
        engine.runRenderLoop(() => {
            scene.render();
            timeStep = scene.deltaTime / 1000;
            this.update();
        });

        // Watch for browser/canvas resize events
        window.addEventListener("resize", function () {
            engine.resize();
        });

        // ... YOUR SCENE CREATION
        if (debug) Inspector.Show(scene, {});

        var seed = '16353fgdeb';

        var camera = new BABYLON.ArcRotateCamera("arcCam", BABYLON.Tools.ToRadians(45), BABYLON.Tools.ToRadians(45), 200.0, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);

        var hemLight = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(-1, 1, -1), scene);
        var dirLight = new BABYLON.DirectionalLight("dir", hemLight.direction.multiplyByFloats(1, -1, 1), scene);
        hemLight.intensity = 0.3;
        dirLight.intensity = 0.5;


        //just for a better look
        var shadowGenerator = new BABYLON.CascadedShadowGenerator(1024, dirLight);

        var pipeline = new BABYLON.DefaultRenderingPipeline("default", false, scene, [camera]);
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.4;
        pipeline.bloomWeight = 2.0;
        pipeline.bloomKernel = 64;
        pipeline.bloomScale = 0.5;

        var world = new Mandelbulb();

        var rootOctant = new Octant(world, null, 0, 64);
        (async () => {
            await rootOctant.build(scene);
            /*
            for (let i=0; i<8; i++) {
                await rootOctant.createChild(scene, i);
            }
            */
        })();

        scene.registerBeforeRender(async () => {
            //startChunks();
        });


        var roomWidth = 10;
        var roomHeight = 5;
        var roomDepth = 10; //the units is in chunks

        //the algorithm starts here
        //var perlin = new SimplexNoise(seed);
        var chunks : {[key:string]:Chunk} = {};
        var chunkWidth = 16;

        /*a very inefficient alternative to multithreading
        please do not use this method in your final project
        research on web workers for multithreading
        this is just for testing, it generates one chunk per frame*/
        var xx = 0, yy = 0, zz = 0;
        function startChunks() {
            if (xx < roomWidth && yy < roomHeight && zz < roomDepth) {
                let x = (xx * chunkWidth) - (roomWidth / 2) * chunkWidth;
                let y = (yy * chunkWidth) - (roomHeight / 2) * chunkWidth;
                let z = (zz * chunkWidth) - (roomDepth / 2) * chunkWidth;
                console.log("generating chunk at " + x + " " + y + " " + z);
                let chunk = new Chunk(x,y,z,1,16,world);
                chunk.create();
                chunk.buildMesh(scene);
                chunks[xx + " " + yy + " " + zz] = chunk;

                zz++
                if (zz == roomDepth) {
                    zz = 0;
                    yy++;
                    if (yy == roomHeight) {
                        yy = 0;
                        xx++;
                    }
                }
            }
        }
        //

    }

    update() {
    }

    async startXR() {
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({
            disableTeleportation: false,
            //floorMeshes: [this.ground!],
        });
        xrHelper.baseExperience.onInitialXRPoseSetObservable.add((xrCamera) => {
            this.xr = xrHelper;
        });
        // look for a button on controller
        xrHelper.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {
                const buttonComponent = motionController.getComponent("a-button");
                // exit when button pressed
                buttonComponent?.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed) {
                        xrHelper.baseExperience.exitXRAsync();
                    }
                });
            });
        });
        /*
        const featuresManager = xrHelper.baseExperience.featuresManager; // or any other way to get a features manager
        featuresManager.enableFeature(BABYLON.WebXRFeatureName.TELEPORTATION, "stable", {
            xrInput: xrHelper.input,
            floorMeshes: [this.scene.getMeshByName("ground")!],
        });
        */
    }
}
