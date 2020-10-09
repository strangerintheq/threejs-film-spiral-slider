class ImagesFilm {

    constructor(images) {

        const self = this;
        const infinite = false;
        const waveLength = 1.1;
        const slideCount = 8;
        const precision = 25;
        const radius = 0.7;
        const filmWidth = 0.3;
        const filmColor = '#876'
        const three = configureThree();
        const customDepthMaterial = createDepthMaterial();

        let lastUploadIndex;
        const textures = [];

        const uniforms = {
            rotation: { value: 0 },
        };

        const bgUniforms = {
            rotation: { value: 0 },
            image1: { type: "t" },
            image2: { type: "t" },
            image3: { type: "t" }
        };

        const bgMat = new THREE.ShaderMaterial({
            uniforms: bgUniforms,
            vertexShader: `
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,

            fragmentShader: `
                varying vec2 vUv;
                uniform float rotation;
                uniform sampler2D image1;
                uniform sampler2D image2;
                uniform sampler2D image3;
                void main() {
              
                    vec4 img2 = texture2D(image2, vUv);
     
                    float v = (fract(rotation) - 0.5)*2.;
                    if (v < 0.)
                        gl_FragColor = mix(texture2D(image1, vUv), img2, 1.+v);
                    else
                        gl_FragColor = mix(img2, texture2D(image3, vUv), v);     
                }   
            `
        });

        const s = 1.6
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(s/2*3,s), bgMat);
        bg.position.set(s/2,0,-2)
        three.scene.add(bg);

        const film = new THREE.Object3D();
        film.position.x = -1
        three.scene.add(film);

        images.forEach(addSlide);

        this.rotation = 1.2;

        requestAnimationFrame(function render(t) {
            moveFilm(t);
            three.render();
            requestAnimationFrame(render);
        });

        function configureThree(){

            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.localClippingEnabled = true;
            self.domElement = renderer.domElement;

            const scene = new THREE.Scene();
            scene.add(new THREE.AmbientLight('white', 0.3));
            scene.add(createDirectionalLight());

            const camera = new THREE.OrthographicCamera();
            camera.position.set(0,0,1.5);
            camera.lookAt(scene.position);

            return { scene, render };

            function render() {
                if (renderer.width !== innerWidth ||
                    renderer.height !== innerHeight ){

                    renderer.setSize(innerWidth, innerHeight);
                    camera.top = 1;
                    camera.bottom = -1
                    camera.left = -innerWidth/innerHeight
                    camera.right = -camera.left
                    camera.updateProjectionMatrix();
                }

                renderer.render(scene, camera);
            }
        }

        function createDirectionalLight(){
            const dirLight = new THREE.DirectionalLight('white', 0.7);
            dirLight.castShadow = true;
            dirLight.position.set(-0.1,0.1,1);
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.left = -1;
            dirLight.shadow.camera.right = 1;
            dirLight.shadow.camera.top = 2;
            dirLight.shadow.camera.bottom = -2;
            dirLight.shadow.camera.near = 0.1;
            dirLight.shadow.camera.far = 2;
            return dirLight;
        }

        function addSlide(url, i) {
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            img.src = url;
            img.onload = () => {
                const geom = createGeometry(i);
                const tex = createTexture(img);

                let slide = new THREE.Mesh(geom, createMaterial(tex, i, -1));
                slide.receiveShadow = true;
                film.add(slide);

                slide = new THREE.Mesh(geom, createMaterial(tex, i, 1));
                slide.castShadow = true;
                slide.customDepthMaterial = customDepthMaterial;
                slide.customDepthMaterial.map = tex;
                film.add(slide);

                textures[i] = tex;
            };
        }

        function createMaterial(map, index, side) {
            const mat = new THREE.MeshStandardMaterial({
                map,
                side: THREE.DoubleSide,
                clippingPlanes: [new THREE.Plane(new THREE.Vector3( 0, 0, side ), 0.0001 )],
                alphaTest: 0.5
            });
            mat.onBeforeCompile = shader => {
                shader.uniforms.rotation = uniforms.rotation;
                shader.uniforms.slideIndex = {value: index};
                let main = 'void main('
                let out = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );'

                shader.fragmentShader = shader.fragmentShader.split(main).join( `
            uniform float rotation;
            uniform float slideIndex;
         ` + main).split(out).join(out + `
            float value = abs(slideIndex + vUv.x - rotation);
            value = clamp(value, 0., 1.);
            if (abs(vUv.y - 0.5) < 0.38 && abs(vUv.x - 0.5) < 0.46) {
                float grayscale = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
                gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(grayscale), value);
            }
        `);
            }
            return mat;
        }

        function createDepthMaterial() {
            const mat = new THREE.MeshDepthMaterial( {
                depthPacking: THREE.RGBADepthPacking,
                alphaTest: 0.5
            });
            mat.onBeforeCompile = shader => {
                shader.fragmentShader = shader
                    .fragmentShader.split('}')
                    .join(`if (fragCoordZ>0.5) {discard;}}`)
                //console.log(shader.fragmentShader)
            }
            return mat;
        }

        function createTexture(img) {

            const pad = 10;
            const width = img.width + pad*2;
            const holesCount = 10;
            const w = width/holesCount/2;
            const h = w;

            const canvas = document.createElement('canvas');
            canvas.height = img.height + pad*4+h*2;
            canvas.width = width;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = filmColor;
            ctx.fillRect(0,0,1e5,1e5);
            ctx.drawImage(img, pad, pad*2+h);

            for (let i = 0; i<holesCount; i++) {
                const x = i*2*w + w/2;
                ctx.clearRect(x, pad, w, h)
                ctx.clearRect(x, canvas.height-pad-h, w, h)
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy=4
            return texture
        }

        function createGeometry(i) {
            const vertices = [] ;
            const uvs = [];

            for (let n = 0; n < precision; n++){
                addVertices(vertices, i, n)
                addUvs(uvs, n);
            }

            for (let j = 0; j < vertices.length; j += 3) {
                vertices[j] = Math.cos(vertices[j])*radius;
                vertices[j+2] = Math.sin(vertices[j+2])*radius;
            }

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
            geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
            geom.computeVertexNormals();
            return geom;
        }

        function addVertices(vertices, i, n) {
            const index = i*precision+n;
            const i1 = index/(slideCount * precision);
            const i2 = (index+1)/(slideCount * precision);
            const a1 = i1*Math.PI*2;
            const a2 = i2*Math.PI*2
            const dy1 = i1*waveLength - filmWidth;
            const dy2 = i2*waveLength - filmWidth;

            vertices.push(
                a1,  filmWidth+dy1, a1,
                a1, -filmWidth+dy1, a1,
                a2, -filmWidth+dy2, a2,

                a2,  filmWidth+dy2, a2,
                a2, -filmWidth+dy2, a2,
                a1,  filmWidth+dy1, a1,
            );
        }

        function addUvs(uvs, n){
            const x0 = n/precision;
            const x1 = (n+1)/precision;
            uvs.push(
                x0, 1,
                x0, 0,
                x1, 0,

                x1, 1,
                x1, 0,
                x0, 1,
            );
        }

        function moveFilm(t){

            film.rotation.y += (self.rotation - film.rotation.y)/20;
            film.rotation.y += Math.sin(t/2000)/500
            film.position.y = -film.rotation.y/(Math.PI*2/waveLength);

            if (infinite) {
                film.position.y = film.position.y%waveLength - waveLength;
            }

            const v = slideCount * film.rotation.y / (Math.PI*2) + 2;
            uniforms.rotation.value = v;
            bgUniforms.rotation.value = v;

            const currentIndex = v|0;
            if (currentIndex !== lastUploadIndex && textures[currentIndex]){
                bgUniforms.image1.value = textures[currentIndex-1];
                bgUniforms.image2.value = textures[currentIndex];
                bgUniforms.image3.value = textures[currentIndex+1];
                lastUploadIndex = currentIndex;
            }

        }

    }
}
