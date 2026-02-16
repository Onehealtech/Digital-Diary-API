import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull
} from "sequelize-typescript";

@Table({
  tableName: "image_histories",
  timestamps: true
})
export default class ImageHistory extends Model {

  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  diaryId!: string;   // patientId / userId etc

  @AllowNull(false)
  @Column(DataType.STRING)
  imagePath!: string;

  @Column(DataType.STRING)
  fileName!: string;
}
