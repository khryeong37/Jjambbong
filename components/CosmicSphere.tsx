import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const CosmicSphere: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;
        const mount = mountRef.current;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.z = 2.5;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        mount.appendChild(renderer.domElement);

        // Molecule (Particle Sphere)
        const radius = 1.3;
        const detail = 40;
        const particleSizeMin = 0.01;
        const particleSizeMax = 0.08;

        const dot = (size = 64, color = "#FFFFFF") => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return new THREE.Texture();
            const circle = new Path2D();
            circle.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill(circle);
            return new THREE.CanvasTexture(canvas);
        };

        const geometry = new THREE.IcosahedronGeometry(1, detail);
        const material = new THREE.PointsMaterial({
            map: dot(),
            blending: THREE.AdditiveBlending,
            color: 0x203AFF, // Vibrant Blue
            depthTest: false,
        });

        // Shader Injection
        const noiseShader = document.getElementById("webgl-noise")?.textContent;
        if (noiseShader) {
            material.onBeforeCompile = (shader) => {
                shader.uniforms.time = { value: 0 };
                shader.uniforms.radius = { value: radius };
                shader.uniforms.particleSizeMin = { value: particleSizeMin };
                shader.uniforms.particleSizeMax = { value: particleSizeMax };
                shader.vertexShader = 'uniform float particleSizeMax;\n' + shader.vertexShader;
                shader.vertexShader = 'uniform float particleSizeMin;\n' + shader.vertexShader;
                shader.vertexShader = 'uniform float radius;\n' + shader.vertexShader;
                shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
                shader.vertexShader = noiseShader + "\n" + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `
                      vec3 p = position;
                      float n = snoise( vec3( p.x*.6 + time*0.2, p.y*0.4 + time*0.3, p.z*.2 + time*0.2) );
                      p += n *0.3;
                      float l = radius / length(p);
                      p *= l;
                      float s = mix(particleSizeMin, particleSizeMax, n);
                      vec3 transformed = vec3( p.x, p.y, p.z );
                    `
                );
                shader.vertexShader = shader.vertexShader.replace(
                    'gl_PointSize = size;',
                    'gl_PointSize = s * 500.0;' // Adjust size multiplier for visibility
                );
                material.userData.shader = shader;
            };
        }

        const mesh = new THREE.Points(geometry, material);
        scene.add(mesh);
        
        // Resize handler
        const handleResize = () => {
            if (!mount) return;
            const w = mount.clientWidth;
            const h = mount.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(mount);

        // Animation loop
        let animationFrameId: number;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const time = performance.now() * 0.001;
            mesh.rotation.set(0, time * 0.15, 0);
            if (material.userData.shader) {
                material.userData.shader.uniforms.time.value = time;
            }
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup
        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            if (mount.contains(renderer.domElement)) {
                mount.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return <div ref={mountRef} className="w-full h-full" />;
};

export default CosmicSphere;