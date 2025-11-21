import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useLocation } from 'wouter';
import L from 'leaflet';
import { MapPin, Users, User } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface WarGroup {
  id: string;
  name: string;
  city: string;
  state: string;
  description: string | null;
  memberCount: number;
  latitude?: number | null;
  longitude?: number | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

interface WarGroupsMapProps {
  groups: WarGroup[];
}

export default function WarGroupsMap({ groups }: WarGroupsMapProps) {
  const [, setLocation] = useLocation();
  
  // Filter to only include groups with valid coordinates
  // Backend geocodes missing coordinates automatically
  const groupsWithCoords = groups
    .filter(group => group.latitude && group.longitude)
    .map(group => ({
      ...group,
      lat: group.latitude!,
      lng: group.longitude!,
    }));

  const center = groupsWithCoords.length > 0
    ? {
        lat: groupsWithCoords.reduce((sum, g) => sum + g.lat, 0) / groupsWithCoords.length,
        lng: groupsWithCoords.reduce((sum, g) => sum + g.lng, 0) / groupsWithCoords.length,
      }
    : { lat: 39.8283, lng: -98.5795 };

  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden border-2 border-black" data-testid="map-war-groups">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={groupsWithCoords.length > 1 ? 4 : 6}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {groupsWithCoords.map((group) => (
          <Marker key={group.id} position={[group.lat, group.lng]}>
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-lg mb-1">{group.name}</h3>
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                  <MapPin className="h-3 w-3" />
                  {group.city}, {group.state}
                </div>
                {group.description && (
                  <p className="text-sm mb-2 line-clamp-2">{group.description}</p>
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-sm">
                    <Users className="h-3 w-3" />
                    <span>{group.memberCount} members</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                  <User className="h-3 w-3" />
                  <span>Led by {group.leader.firstName} {group.leader.lastName}</span>
                </div>
                <button
                  onClick={() => setLocation(`/war-groups/${group.id}`)}
                  className="block w-full bg-ministry-gold-exact hover:bg-yellow-500 text-black font-bold py-2 px-4 rounded text-center text-sm cursor-pointer border-none"
                  data-testid={`button-view-group-${group.id}`}
                >
                  View Group
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
