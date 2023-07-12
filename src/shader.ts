import * as BABYLON from "@babylonjs/core";

const SHADER_FUNCS = `
varying vec3 vWorldPos;

const int maxIterations = 50;
const float bailout = 2.0;
const float power = 8.0;
const float scale = 1.0 / 50.0;

// Mandelbulb distance estimator function
float mandelbulb_distance_estimator(vec3 position) {
    vec3 p = position * scale;
    float dr = 1.0;
    float r = 0.0;
    
    for (int i = 0; i < maxIterations; i++) {
        r = length(p);
        if (r > bailout) {
            break;
        }
        
        // Convert to polar coordinates
        float theta = acos(p.z / r);
        float phi = atan(p.y, p.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;
        
        // Scale and rotate the point
        float zr = pow (r, power);
        theta = theta * power;
        phi = phi * power;

        // Convert back to Cartesian coordinates
        vec3 z = zr * vec3 (sin (theta) * cos (phi), sin (phi) * sin (theta), cos (theta));
        p = z + position * scale;
    }
    
    return 0.5 * log(r) * r / dr;
}

vec3 mandelbulb_normal_estimator(vec3 xyz) {
    // Compute the distance to the Mandelbulb
    float distance = mandelbulb_distance_estimator(xyz);

    // Correct the position using the distance
    xyz = xyz * (1.0 - distance);
    distance = mandelbulb_distance_estimator(xyz);

    xyz = xyz * (1.0 - distance);
    distance = mandelbulb_distance_estimator(xyz);

    // Calculate the normal using central difference approximation
    float epsilon = 0.1;
    vec3 normal = vec3(
        mandelbulb_distance_estimator(xyz + vec3(epsilon, 0.0, 0.0)) - distance,
        mandelbulb_distance_estimator(xyz + vec3(0.0, epsilon, 0.0)) - distance,
        mandelbulb_distance_estimator(xyz + vec3(0.0, 0.0, epsilon)) - distance
    );
    return normal;
}
`
/**

 * Extend from MaterialPluginBase to create your plugin.
 */
export class MandelbulbPluginMaterial extends BABYLON.MaterialPluginBase {
    constructor(material: BABYLON.Material) {
        // the second parameter is the name of this plugin.
        // the third one is a priority, which lets you define the order multiple plugins are run. Lower numbers run first.
        // the fourth one is a list of defines used in the shader code.
        super(material, "Mandelbulb", 200, { Mandelbulb: false });

        // let's enable it by default
        this._enable(true);
    }

    // Also, you should always associate a define with your plugin because the list of defines (and their values)
    // is what triggers a recompilation of the shader: a shader is recompiled only if a value of a define changes.
    prepareDefines(defines: BABYLON.MaterialDefines, scene: BABYLON.Scene, mesh: BABYLON.AbstractMesh) {
        defines["Mandelbulb"] = true;
    }

    getClassName() {
        return "MandelbulbPluginMaterial";
    }

    getCustomCode(shaderType: "vertex" | "fragment"): any {
        if (shaderType === "vertex") {
            return {
                CUSTOM_VERTEX_DEFINITIONS: `
                    varying vec3 vWorldPos;
                `,
                CUSTOM_VERTEX_MAIN_END: `
                    vWorldPos = worldPos.xyz; 
                `
            }
        }
        else if (shaderType === "fragment") {
            // we're adding this specific code at the end of the main() function
            return {
                CUSTOM_FRAGMENT_DEFINITIONS: SHADER_FUNCS,
                CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
                normalW = normalize(mandelbulb_normal_estimator(vPositionW));
                `,
                CUSTOM_FRAGMENT_MAIN_END: `
                    //vec3 normal = mandelbulb_normal_estimator(vWorldPos.xyz);
                    //gl_FragColor = vec4(normalize(normal), 1.0);
                    //gl_FragColor = vec4(vWorldPos.xyz/50.0, 1.0);
                `
            };
        }
        // for other shader types we're not doing anything, return null
        return null;
    }

    static register() {
        BABYLON.RegisterMaterialPlugin("Mandelbulb", (material: any) => {
            material.mandelbulb = new MandelbulbPluginMaterial(material);
            return material.mandelbulb;
        });
    }
}

