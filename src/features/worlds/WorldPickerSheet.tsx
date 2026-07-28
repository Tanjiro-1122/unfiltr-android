import { ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getWorldsFor, type WorldId, type WorldModule } from '@/lib/worlds/catalog';

type WorldPickerSheetProps = {
  module: WorldModule;
  onClose: () => void;
  onSelect: (worldId: WorldId) => void;
  selectedWorldId: WorldId;
  visible: boolean;
};

export function WorldPickerSheet({
  module,
  onClose,
  onSelect,
  selectedWorldId,
  visible,
}: WorldPickerSheetProps) {
  const worlds = getWorldsFor(module);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityLabel="Close world picker" onPress={onClose} style={styles.scrim}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>YOUR WORLD</Text>
              <Text style={styles.title}>
                {module === 'journal' ? 'Journal background' : 'Chat background'}
              </Text>
              <Text style={styles.copy}>Choose the room that feels right today.</Text>
            </View>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {worlds.map((world) => {
              const selected = world.id === selectedWorldId;
              return (
                <Pressable
                  accessibilityLabel={`Use ${world.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={world.id}
                  onPress={() => {
                    onSelect(world.id);
                    onClose();
                  }}
                  style={[styles.card, selected && { borderColor: world.accent }]}
                >
                  <ImageBackground
                    imageStyle={styles.previewImage}
                    resizeMode="cover"
                    source={{ uri: world.backgroundImage }}
                    style={styles.preview}
                  >
                    <View style={styles.previewShade} />
                    {selected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{world.label}</Text>
                      <Text style={styles.cardCopy}>{world.desc}</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardCopy: { color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 17, marginTop: 3 },
  cardText: { bottom: 0, left: 0, padding: 14, position: 'absolute', right: 0 },
  cardTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  closeText: { color: '#FFFFFF', fontSize: 27, lineHeight: 29 },
  copy: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginTop: 4 },
  eyebrow: { color: '#D8B4FE', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  grid: { paddingBottom: 36, paddingHorizontal: 18 },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: 3,
    height: 5,
    marginTop: 10,
    width: 44,
  },
  header: { alignItems: 'flex-start', flexDirection: 'row', padding: 18 },
  headerText: { flex: 1, paddingRight: 12 },
  preview: { height: 145, justifyContent: 'flex-end' },
  previewImage: { borderRadius: 16 },
  previewShade: {
    backgroundColor: 'rgba(4,1,12,0.25)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrim: { backgroundColor: 'rgba(0,0,0,0.68)', flex: 1, justifyContent: 'flex-end' },
  selectedBadge: {
    backgroundColor: 'rgba(124,58,237,0.92)',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    right: 10,
    top: 10,
  },
  sheet: {
    backgroundColor: '#10031F',
    borderColor: 'rgba(168,85,247,0.28)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    maxHeight: '86%',
  },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 5 },
});
