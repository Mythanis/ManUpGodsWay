import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import { useLocation } from 'wouter';
import L from 'leaflet';
import { MapPin, Users, User, Clock } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const goldIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="#FCD000" stroke="#000" stroke-width="1" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z"/>
      <circle fill="#000" cx="12" cy="12" r="5"/>
    </svg>
  `),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
  tooltipAnchor: [0, -36],
});

interface WarGroup {
  id: string;
  name: string;
  city: string;
  state: string;
  description: string | null;
  memberCount: number;
  meetingInfo: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHeadquarters?: boolean | null;
  leader: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

function getGroupDisplayName(group: WarGroup): string {
  if (group.isHeadquarters) {
    return "War Group HQ";
  }
  return `Outpost: ${group.city}`;
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
    <div className="h-[500px] w-full rounded-lg overflow-hidden border-2 border-black relative z-0" data-testid="map-war-groups">
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
          <Marker key={group.id} position={[group.lat, group.lng]} icon={goldIcon}>
            <Tooltip 
              direction="top" 
              offset={[0, -20]} 
              opacity={1}
              className="!bg-zinc-900 !border-ministry-gold-exact !border-2 !rounded-lg !shadow-xl"
            >
              <div className="min-w-[220px] p-2 text-white">
                <h3 className="font-bold text-base mb-1 text-ministry-gold-exact">{getGroupDisplayName(group)}</h3>
                <div className="flex items-center gap-1 text-xs text-zinc-300 mb-1">
                  <MapPin className="h-3 w-3 text-ministry-gold-exact" />
                  {group.city}, {group.state}
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-300 mb-1">
                  <User className="h-3 w-3 text-ministry-gold-exact" />
                  <span>Led by {group.leader.firstName} {group.leader.lastName}</span>
                </div>
                {group.meetingInfo && (
                  <div className="flex items-start gap-1 text-xs text-zinc-300">
                    <Clock className="h-3 w-3 text-ministry-gold-exact flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{group.meetingInfo}</span>
                  </div>
                )}
              </div>
            </Tooltip>
            <Popup>
              <div className="min-w-[220px]">
                <h3 className="font-bold text-lg mb-1">{getGroupDisplayName(group)}</h3>
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
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                  <User className="h-3 w-3" />
                  <span>Led by {group.leader.firstName} {group.leader.lastName}</span>
                </div>
                {group.meetingInfo && (
                  <div className="flex items-start gap-1 text-sm text-gray-600 mb-3">
                    <Clock className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{group.meetingInfo}</span>
                  </div>
                )}
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
