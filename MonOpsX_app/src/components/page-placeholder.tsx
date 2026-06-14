import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
export function PagePlaceholder({ icon, message }: { icon: React.ComponentProps<typeof Ionicons>["name"]; message: string }) { return <View style={styles.box}><Ionicons name={icon} size={44} color={colors.primary} /><Text style={styles.title}>{message}</Text><Text style={styles.text}>Cette section sera développée prochainement.</Text></View>; }
const styles=StyleSheet.create({box:{flex:1,minHeight:420,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:radii.large,backgroundColor:colors.card,padding:spacing.xl},title:{color:colors.text,fontFamily:fonts.bold,fontSize:typography.h3,marginTop:spacing.md},text:{color:colors.muted,fontFamily:fonts.regular,fontSize:typography.body,marginTop:spacing.sm,textAlign:"center"}});
