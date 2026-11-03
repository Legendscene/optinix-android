import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { GLView } from 'expo-gl'
import * as THREE from 'three'

import { useTheme } from '../../theme/ThemeProvider'

function fakeCanvas(gl) {
  return {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  }
}

export function OrbScene({
  size = 220,
  accent = '#00e5cc',
  health = null,
  active = false,
  reducedMotion = false,
  style,
}) {
  const theme = useTheme()
  const [failed, setFailed] = useState(false)
  const visuals = useRef(null)
  const live = useRef({ accent, health, active, reducedMotion })

  useEffect(() => {
    live.current = { accent, health, active, reducedMotion }
    const scene = visuals.current
    if (!scene) return
    const color = new THREE.Color(accent)
    scene.materials.forEach((material) => material.color?.set(color))
    if (scene.frame) cancelAnimationFrame(scene.frame)
    scene.frame = null
    if (reducedMotion || !active) {
      scene.renderer.render(scene.scene, scene.camera)
      scene.gl.endFrameEXP()
    } else scene.animate?.()
  }, [accent, health, active, reducedMotion])

  useEffect(
    () => () => {
      const scene = visuals.current
      visuals.current = null
      if (!scene) return
      if (scene.frame) cancelAnimationFrame(scene.frame)
      scene.geometries.forEach((geometry) => geometry.dispose())
      scene.materials.forEach((material) => material.dispose())
      scene.renderer.dispose()
    },
    [],
  )

  const onContextCreate = (gl) => {
    try {
      const width = gl.drawingBufferWidth
      const height = gl.drawingBufferHeight
      const renderer = new THREE.WebGLRenderer({
        canvas: fakeCanvas(gl),
        context: gl,
        antialias: true,
        alpha: true,
      })
      renderer.setSize(width, height)
      renderer.setClearColor(0x000000, 0)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
      camera.position.z = 3.5

      const color = new THREE.Color(live.current.accent)
      const geometries = []
      const materials = []

      const shellGeometry = new THREE.IcosahedronGeometry(1, 1)
      const shellMaterial = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      })
      const shell = new THREE.Mesh(shellGeometry, shellMaterial)

      const coreGeometry = new THREE.IcosahedronGeometry(0.94, 2)
      const coreMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const core = new THREE.Mesh(coreGeometry, coreMaterial)

      const count = 680
      const positions = new Float32Array(count * 3)
      for (let index = 0; index < count; index += 1) {
        const radius = 1.24 + Math.random() * 0.42
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[index * 3 + 2] = radius * Math.cos(phi)
      }
      const cloudGeometry = new THREE.BufferGeometry()
      cloudGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const cloudMaterial = new THREE.PointsMaterial({
        color,
        size: 0.016,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      const cloud = new THREE.Points(cloudGeometry, cloudMaterial)

      const ringGeometry = new THREE.TorusGeometry(1.34, 0.0038, 8, 180)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
      })
      const ringA = new THREE.Mesh(ringGeometry, ringMaterial)
      ringA.rotation.x = Math.PI / 2.35

      const ringB = new THREE.Mesh(ringGeometry, ringMaterial.clone())
      ringB.rotation.x = Math.PI / 1.65
      ringB.rotation.y = Math.PI / 3
      const ringMaterialB = ringB.material
      ringMaterialB.opacity = 0.26

      const group = new THREE.Group()
      group.add(shell, core, cloud, ringA, ringB)
      scene.add(group)

      geometries.push(shellGeometry, coreGeometry, cloudGeometry, ringGeometry)
      materials.push(shellMaterial, coreMaterial, cloudMaterial, ringMaterial, ringMaterialB)

      visuals.current = {
        gl,
        renderer,
        scene,
        camera,
        group,
        ringA,
        ringB,
        cloud,
        materials,
        geometries,
        frame: null,
      }

      const clock = new THREE.Clock()
      const animate = () => {
        const current = visuals.current
        if (!current) return
        const state = live.current
        if (state.reducedMotion || !state.active) { current.frame = null; return }
        current.frame = requestAnimationFrame(animate)

        const time = clock.getElapsedTime()
        const energy = state.health == null ? 0.4 : Math.max(0, Math.min(1, (100 - state.health) / 100))
        const speed = 0.22 + energy * 0.38

        current.group.rotation.y = time * speed * (state.active ? 1.5 : 1)
        current.group.rotation.x = Math.sin(time * 0.42) * 0.16
        current.group.scale.setScalar(1 + Math.sin(time * (1.1 + energy)) * (0.012 + energy * 0.018))
        current.ringA.rotation.z = time * 0.55
        current.ringB.rotation.z = -time * 0.34
        current.cloud.rotation.y = -time * 0.07

        current.renderer.render(current.scene, current.camera)
        current.gl.endFrameEXP()
      }

      visuals.current.animate = animate
      if (live.current.reducedMotion || !live.current.active) {
        renderer.render(scene, camera)
        gl.endFrameEXP()
      } else {
        animate()
      }
    } catch {
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size }, style]}>
        <View
          style={[
            styles.fallbackRing,
            {
              width: size * 0.86,
              height: size * 0.86,
              borderRadius: size,
              borderColor: theme.accent.line,
              backgroundColor: theme.accent.dim,
            },
          ]}
        />
        <View
          style={[
            styles.fallbackRing,
            {
              width: size * 0.6,
              height: size * 0.6,
              borderRadius: size,
              borderColor: theme.accent.color,
            },
          ]}
        />
        <View
          style={{
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: size,
            backgroundColor: theme.accent.color,
            opacity: 0.5,
          }}
        />
      </View>
    )
  }

  return (
    <GLView
      style={[{ width: size, height: size }, style]}
      onContextCreate={onContextCreate}
      msaaSamples={4}
    />
  )
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackRing: { position: 'absolute', borderWidth: 1 },
})

export default OrbScene
