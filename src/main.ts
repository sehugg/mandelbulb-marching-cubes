

//import { Inspector } from '@babylonjs/inspector';
import * as BABYLON from "@babylonjs/core";
// import STL loader
import "@babylonjs/loaders";
import { Chunk } from "./chunk";
import { Mandelbulb } from "./mandel";
import { Octant } from "./octant";
import { MandelbulbPluginMaterial } from './shader';

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
        // set background to black
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

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
        if (debug) {
            //Inspector.Show(scene, {});
        }

        var camera = new BABYLON.ArcRotateCamera("arcCam", BABYLON.Tools.ToRadians(45), BABYLON.Tools.ToRadians(45), 200.0, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);

        var hemLight = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(-1, 1, -1), scene);
        hemLight.intensity = 0.5;
        hemLight.diffuse = new BABYLON.Color3(0.5, 0.4, 0.3);
        hemLight.groundColor = new BABYLON.Color3(0.2, 0.1, 0.05);

        var dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(1, -1, 1), scene);
        dirLight.intensity = 0.5;
        dirLight.diffuse = new BABYLON.Color3(0.6, 0.8, 1.0);

        /*
         var dirLight1 = new BABYLON.DirectionalLight("dir1", new BABYLON.Vector3(1,1,1), scene);
         dirLight1.intensity = 0.5;
         dirLight1.diffuse = new BABYLON.Color3(0.2, 0.6, 1);
         var dirLight2 = new BABYLON.DirectionalLight("dir2", new BABYLON.Vector3(-1,-1,-1), scene);
         dirLight2.intensity = 0.5;
         dirLight2.diffuse = new BABYLON.Color3(1, 0.2, 0.6);
         */

        //just for a better look
        // https://playground.babylonjs.com/#FH3FM2#83
        var shadowGenerator = new BABYLON.CascadedShadowGenerator(1024, dirLight);
        shadowGenerator.bias = 0.001;
        shadowGenerator.normalBias = 0.02;
        dirLight.shadowMaxZ = 100;
        dirLight.shadowMinZ = 10;
        shadowGenerator.useContactHardeningShadow = true;
        shadowGenerator.contactHardeningLightSizeUVRatio = 0.05;
        shadowGenerator.setDarkness(0.5);
        //Octant.shadowGenerator = shadowGenerator;


        var pipeline = new BABYLON.DefaultRenderingPipeline("default", false, scene, [camera]);
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.4;
        pipeline.bloomWeight = 2.0;
        pipeline.bloomKernel = 64;
        pipeline.bloomScale = 0.5;

        /*        
        // Create SSAO and configure all properties (for the example)
        var ssaoRatio = {
            ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
            combineRatio: 1.0 // Ratio of the combine post-process (combines the SSAO and the scene)
        };
        var ssao = new BABYLON.SSAORenderingPipeline("ssao", scene, ssaoRatio, [camera]);
        ssao.fallOff = 0.000001;
        ssao.area = 1;
        ssao.radius = 0.0001;
        ssao.totalStrength = 1.0;
        ssao.base = 0.5;
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);
        scene.postProcessRenderPipelineManager.disableEffectInPipeline("ssaopipeline", ssao.SSAOCombineRenderEffect, camera);
        */

        var world = new Mandelbulb();

        var rootOctant = new Octant(world, null, 0, 64);
        // build first octant
        (async () => {
            await rootOctant.build(scene);
            console.log(BABYLON.ShaderStore);
        })();
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
                const thumbstick = motionController.getAllComponentsOfType("thumbstick");
                thumbstick[0]?.onAxisValueChangedObservable.add((component) => {
                    // move the camera
                    xrHelper.baseExperience.camera.position.addInPlace(new BABYLON.Vector3(component.x, 0, component.y));
                });
                thumbstick[1]?.onAxisValueChangedObservable.add((component) => {
                    // rotate the camera
                    xrHelper.baseExperience.camera.rotation.y += component.x * 0.1;
                    xrHelper.baseExperience.camera.rotation.x += component.y * 0.1;
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
