<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.2" name="office_architecture" tilewidth="32" tileheight="32" tilecount="32" columns="8">
 <image source="office_architecture.png" width="256" height="128"/>
 <tile id="0">
  <properties>
   <property name="name" value="wood_light"/>
   <property name="zone" value="common"/>
  </properties>
 </tile>
 <tile id="1">
  <properties>
   <property name="name" value="wood_dark"/>
   <property name="zone" value="common"/>
  </properties>
 </tile>
 <tile id="2">
  <properties>
   <property name="name" value="server_floor_light"/>
   <property name="zone" value="server"/>
  </properties>
 </tile>
 <tile id="3">
  <properties>
   <property name="name" value="server_floor_dark"/>
   <property name="zone" value="server"/>
  </properties>
 </tile>
 <tile id="4">
  <properties>
   <property name="name" value="executive_floor_light"/>
   <property name="zone" value="manager"/>
  </properties>
 </tile>
 <tile id="5">
  <properties>
   <property name="name" value="executive_floor_dark"/>
   <property name="zone" value="manager"/>
  </properties>
 </tile>
 <tile id="6">
  <properties>
   <property name="name" value="studio_floor_light"/>
   <property name="zone" value="studio"/>
  </properties>
 </tile>
 <tile id="7">
  <properties>
   <property name="name" value="studio_floor_dark"/>
   <property name="zone" value="studio"/>
  </properties>
 </tile>
 <tile id="8">
  <properties>
   <property name="name" value="lobby_floor_light"/>
   <property name="zone" value="lobby"/>
  </properties>
 </tile>
 <tile id="9">
  <properties>
   <property name="name" value="lobby_floor_dark"/>
   <property name="zone" value="lobby"/>
  </properties>
 </tile>
 <tile id="10">
  <properties>
   <property name="name" value="records_floor_light"/>
   <property name="zone" value="records"/>
  </properties>
 </tile>
 <tile id="11">
  <properties>
   <property name="name" value="records_floor_dark"/>
   <property name="zone" value="records"/>
  </properties>
 </tile>
 <tile id="12">
  <properties>
   <property name="name" value="meeting_floor_light"/>
   <property name="zone" value="meeting"/>
  </properties>
 </tile>
 <tile id="13">
  <properties>
   <property name="name" value="meeting_floor_dark"/>
   <property name="zone" value="meeting"/>
  </properties>
 </tile>
 <tile id="14">
  <properties>
   <property name="name" value="pantry_floor_light"/>
   <property name="zone" value="pantry"/>
  </properties>
 </tile>
 <tile id="15">
  <properties>
   <property name="name" value="pantry_floor_dark"/>
   <property name="zone" value="pantry"/>
  </properties>
 </tile>
 <tile id="16">
  <properties>
   <property name="name" value="play_floor_light"/>
   <property name="zone" value="play"/>
  </properties>
 </tile>
 <tile id="17">
  <properties>
   <property name="name" value="play_floor_dark"/>
   <property name="zone" value="play"/>
  </properties>
 </tile>
 <tile id="18">
  <properties>
   <property name="name" value="corridor_runway"/>
   <property name="zone" value="corridor"/>
  </properties>
 </tile>
 <tile id="19">
  <properties>
   <property name="name" value="corridor_accent_runner"/>
   <property name="zone" value="corridor"/>
  </properties>
 </tile>
 <tile id="20">
  <properties>
   <property name="collision" type="bool" value="true"/>
   <property name="name" value="wall_wood_crown"/>
  </properties>
  <objectgroup draworder="index" id="2">
   <object id="1" name="solid" x="0" y="0" width="32" height="32"/>
  </objectgroup>
 </tile>
 <tile id="21">
  <properties>
   <property name="collision" type="bool" value="true"/>
   <property name="has_emission" type="bool" value="true"/>
   <property name="name" value="server_wall_cyan"/>
  </properties>
  <objectgroup draworder="index" id="2">
   <object id="1" name="solid" x="0" y="0" width="32" height="32"/>
  </objectgroup>
 </tile>
 <tile id="22">
  <properties>
   <property name="is_elevator" type="bool" value="true"/>
   <property name="name" value="elevator_hub_tile"/>
  </properties>
 </tile>
 <tile id="23">
  <properties>
   <property name="name" value="executive_rug_velvet"/>
  </properties>
 </tile>
</tileset>
