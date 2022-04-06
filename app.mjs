import imagemin from 'imagemin'
import imageminWebp from 'imagemin-webp'

imagemin(['./jpg-png/*.{jpg,png,tif}'], {
  destination: './webp/',
  plugins: [
    imageminWebp({
      quality: 100,
    }),
  ],
}).then(() => {
  console.log('Картинките бяха успешно конвертирани в webp!!!')
})
