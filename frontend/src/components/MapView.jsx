import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const BENGALURU = [12.9716, 77.5946]

// points: [{ lat, lng, label, onClick }]. me: the user's position. onPick: called with { lat, lng } on click.
// Circle markers avoid Leaflet's default icon images, which break under bundlers.
export default function MapView({ points = [], me, onPick, className = 'h-80' }) {
  const el = useRef()
  const map = useRef()
  const layer = useRef()
  const pick = useRef(onPick)
  pick.current = onPick

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView(BENGALURU, 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    map.current.on('click', (e) => pick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    return () => map.current.remove()
  }, [])

  useEffect(() => {
    layer.current.clearLayers()
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: '#0f766e', weight: 2, fillColor: '#14b8a6', fillOpacity: 0.9 })
        .bindTooltip(p.label)
        .on('click', () => p.onClick?.())
        .addTo(layer.current)
    }
    if (me) L.circleMarker([me.lat, me.lng], { radius: 7, color: '#1d4ed8', weight: 3, fillColor: '#60a5fa', fillOpacity: 1 }).bindTooltip('You').addTo(layer.current)
    const all = [...points, ...(me ? [me] : [])]
    // No animation: an animation still running when the map unmounts throws inside Leaflet.
    if (all.length === 1) map.current.setView([all[0].lat, all[0].lng], 14, { animate: false })
    else if (all.length) map.current.fitBounds(all.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 14, animate: false })
  }, [points, me])

  return <div ref={el} className={`z-0 w-full rounded-lg border border-gray-200 ${className}`} role="region" aria-label="Map" />
}
