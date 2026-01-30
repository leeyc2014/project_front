'use client';

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

interface PathPoint {
  lat: number;
  lng: number;
  isAnomaly?: boolean;
  desc?: string;
}

interface KakaoMapProps {
  path?: PathPoint[];
  address?: string; // 주소를 직접 받을 수 있도록 prop 추가
  startToken?: number;
}

export default function KakaoMap({ path, address, startToken = 0 }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const zoomOutTimeoutRef = useRef<number | null>(null);
  const objectsRef = useRef<{ polyline: any; markers: any[]; infowindow: any }>({
    polyline: null,
    markers: [],
    infowindow: null,
  });

  // 지도 스크립트 로드 및 초기화
  useEffect(() => {
    const initMap = () => {
      if (mapRef.current || !containerRef.current) return;

      const mapOptions = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 5,
      };
      const map = new window.kakao.maps.Map(containerRef.current, mapOptions);
      mapRef.current = map;
      objectsRef.current.infowindow = new window.kakao.maps.InfoWindow({ zIndex: 1 });

      updateMapObjects(path, address, startToken);

      // path나 address가 초기에 주입된 경우를 위해 지도 객체 업데이트 호출
    };

    if (window.kakao && window.kakao.maps) {
      initMap();
    } else {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false&libraries=clusterer,services`;
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => {
        window.kakao.maps.load(initMap);
      };
    }
    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (zoomOutTimeoutRef.current) {
        window.clearTimeout(zoomOutTimeoutRef.current);
        zoomOutTimeoutRef.current = null;
      }
    };
  }, []); // 이 useEffect는 마운트 시 한 번만 실행

  // path나 address가 변경될 때 지도 업데이트
  useEffect(() => {
    updateMapObjects(path, address, startToken);
  }, [path, address, startToken]);

  const createPointMarker = (point: PathPoint, position: any, label: string) => {
    const map = mapRef.current;
    const markerColor = point.isAnomaly ? "#ef4444" : "#2563eb";
    const svgContent = `<svg width="24" height="35" viewBox="0 0 24 35" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 35 12 35C12 35 24 21 24 12C24 5.37 18.63 0 12 0ZM12 16.5C9.51 16.5 7.5 14.49 7.5 12C7.5 9.51 9.51 7.5 12 7.5C14.49 7.5 16.5 9.51 16.5 12C16.5 14.49 14.49 16.5 12 16.5Z" fill="${markerColor}"/></svg>`;
    const imageSrc = `data:image/svg+xml;base64,${btoa(svgContent)}`;
    const imageSize = new window.kakao.maps.Size(24, 35);
    const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);

    const marker = new window.kakao.maps.Marker({ position, image: markerImage, map });
    const iw = objectsRef.current.infowindow;
    window.kakao.maps.event.addListener(marker, 'mouseover', () => {
      const content = `<div style="padding:10px; min-width:150px; font-size:12px; line-height:1.5;"><b style="color:${point.isAnomaly ? '#ef4444' : '#2563eb'}">${label}</b><br/>${point.desc || 'No data'}</div>`;
      iw.setContent(content);
      iw.open(map, marker);
    });
    window.kakao.maps.event.addListener(marker, 'mouseout', () => iw.close());

    objectsRef.current.markers.push(marker);
  };

  const centerMapToFirstPoint = (point?: PathPoint) => {
    if (!point || !mapRef.current) return;
    const map = mapRef.current;
    const position = new window.kakao.maps.LatLng(point.lat, point.lng);
    map.setCenter(position);
  };

  // 지도에 표시될 객체들을 업데이트하는 함수
  const updateMapObjects = (newPath?: PathPoint[], newAddress?: string, token?: number) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const { polyline, markers, infowindow } = objectsRef.current;

    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (zoomOutTimeoutRef.current) {
      window.clearTimeout(zoomOutTimeoutRef.current);
      zoomOutTimeoutRef.current = null;
    }

    // 기존 객체들 제거
    if (polyline) polyline.setMap(null);
    markers.forEach((m) => m.setMap(null));
    objectsRef.current.markers = [];
    if (infowindow) infowindow.close();

    if (token && token > 0 && newPath && newPath.length > 0) {
      drawPath(newPath);
    } else if (token && token > 0 && newAddress) {
      // 주소가 있으면 지오코딩 실행
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(newAddress, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
          const newPoint = { lat: result[0].y, lng: result[0].x, desc: newAddress };
          drawPath([newPoint], true); // 단일 지점은 확대해서 표시
        } else {
          console.error(`'${newAddress}'의 지오코딩에 실패했습니다.`);
        }
      });
    } else if (newPath && newPath.length > 0) {
      centerMapToFirstPoint(newPath[0]);
    } else if (newAddress) {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(newAddress, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
          map.setCenter(coords);
        }
      });
    }
  };

  // 경로를 지도에 그리는 함수
  const drawPath = (currentPath: PathPoint[], singlePointZoom = false) => {
    const map = mapRef.current;
    const points = currentPath.map((p) => new window.kakao.maps.LatLng(p.lat, p.lng));
    const bounds = new window.kakao.maps.LatLngBounds();
    // 1. ??? ??? (??? ????? ??? ???)
    currentPath.forEach((p) => {
      const position = new window.kakao.maps.LatLng(p.lat, p.lng);
      bounds.extend(position);
    });

    // 2. 선 그리기 (경로가 2개 이상일 때)
    if (points.length > 1) {
      const polyline = new window.kakao.maps.Polyline({
        path: [points[0]],
        strokeWeight: 5,
        strokeColor: "#2563eb",
        strokeOpacity: 0.7,
      });
      polyline.setMap(map);
      objectsRef.current.polyline = polyline;

      const mover = new window.kakao.maps.Marker({
        position: points[0],
        map,
      });
      objectsRef.current.markers.push(mover);

      // 첫 지점은 이미 도달한 것으로 간주하고 마커 표시
      createPointMarker(currentPath[0], points[0], "[출발]");

      const segmentMs = 1000;
      let segIndex = 0;
      let segStart: number | null = null;

      const step = (ts: number) => {
        if (segIndex >= points.length - 1) {
          if (animationRef.current) {
            window.cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          zoomOutTimeoutRef.current = window.setTimeout(() => {
            map.setBounds(bounds);
          }, 2000);
          return;
        }

        const start = points[segIndex];
        const end = points[segIndex + 1];

        if (segStart == null) segStart = ts;
        const t = Math.min(1, Math.max(0, (ts - segStart) / segmentMs));

        const lat = start.getLat() + (end.getLat() - start.getLat()) * t;
        const lng = start.getLng() + (end.getLng() - start.getLng()) * t;
        const cur = new window.kakao.maps.LatLng(lat, lng);

        mover.setPosition(cur);
        map.setCenter(cur);

        if (t >= 1) {
          const animatedPath = polyline.getPath();
          animatedPath.push(end);
          polyline.setPath(animatedPath);
          const nextPoint = currentPath[segIndex + 1];
          const isSameAsStart =
            Math.abs(nextPoint.lat - currentPath[0].lat) < 1e-6 &&
            Math.abs(nextPoint.lng - currentPath[0].lng) < 1e-6;
          if (!isSameAsStart) {
            const label = segIndex + 1 === currentPath.length - 1 ? "[도착]" : "[중간]";
            createPointMarker(nextPoint, end, label);
          }
          segIndex += 1;
          segStart = null;
        }

        animationRef.current = window.requestAnimationFrame(step);
      };

      animationRef.current = window.requestAnimationFrame(step);
    }

    if (points.length === 1) {
      createPointMarker(currentPath[0], points[0], "[현재위치]");
    }

    // 3. 지도 범위 설정
    if (singlePointZoom) {
      map.setCenter(points[0]);
      map.setLevel(5);
    } else {
      map.setBounds(bounds);
      const level = map.getLevel();
      map.setLevel(Math.max(2, level - 1));
    }
  };

  return <div ref={containerRef} className="w-full h-full" />;
}
