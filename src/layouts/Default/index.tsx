import Footer from '../../components/Footer'
import Header from '../../components/Header'
import Main from '../../components/Main'
import Banner from '../../components/Banner'
import Popups from '../../components/Popups'

const Layout = ({ children, banner = undefined }) => {
  return (
    <div className="z-0 flex flex-col items-center w-full pb-32 lg:pb-16">
      {banner && <Banner />}
      <Header />
      <Main>{children}</Main>
      <Popups />
      <Footer />
    </div>
  )
}

export default Layout
